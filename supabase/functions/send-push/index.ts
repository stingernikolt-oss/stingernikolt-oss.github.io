// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@kodus.local";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_READY = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (VAPID_READY) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const MESSAGE_TTL = 86400;
const TEST_TTL = 60;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const tail = (s: string) => String(s).slice(-24);

async function sendToSubs(supabase: any, subs: any[], payload: string, ttl: number) {
  const results: any[] = [];
  const invalid: number[] = [];
  for (const sub of subs) {
    try {
      const res = await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
        payload, { TTL: ttl }
      );
      results.push({ endpoint_tail: tail(sub.endpoint), ok: true, statusCode: res.statusCode });
    } catch (err: any) {
      results.push({ endpoint_tail: tail(sub.endpoint), ok: false, statusCode: err?.statusCode ?? null, error: String(err?.message ?? err) });
      if (err?.statusCode === 404 || err?.statusCode === 410) invalid.push(sub.id);
    }
  }
  if (invalid.length) await supabase.from("kodus_push_subscriptions").delete().in("id", invalid);
  return { results, cleaned: invalid.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const expected = Deno.env.get("TRIGGER_SECRET");
  const auth = req.headers.get("Authorization");
  if (!expected || auth !== `Bearer ${expected}`) return json({ error: "Unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  if (body?.ping) return json({ ok: true, pong: true, vapid_configured: VAPID_READY, vapid_public_prefix: VAPID_PUBLIC_KEY.slice(0, 16) });
  if (!VAPID_READY) return json({ error: "VAPID keys not configured" }, 500);

  const url = Deno.env.get("SUPABASE_URL");
  const role = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !role) return json({ error: "SUPABASE env missing" }, 500);
  const supabase = createClient(url, role);

  // Тест себе
  if (body?.test_user_id) {
    const { data: subs } = await supabase.from("kodus_push_subscriptions").select("*").eq("user_id", body.test_user_id);
    if (!subs?.length) return json({ ok: true, mode: "test", subscriptions: 0, reason: "no_subscriptions" });
    const payload = JSON.stringify({ title: "KODUS · тест", body: body?.body ?? "Цепочка работает ✅", icon: "/kodus-icon.png", badge: "/kodus-icon.png", tag: "kodus-test", data: { test: true }, vibrate: [200,100,200] });
    const { results, cleaned } = await sendToSubs(supabase, subs, payload, TEST_TTL);
    return json({ ok: true, mode: "test", subscriptions: subs.length, results, cleaned });
  }

  // Новость всем / рассылка всем
  if (body?.news || body?.broadcast) {
    if (body?.news) {
      const { data: st } = await supabase.from("kodus_app_settings").select("news_enabled").eq("id", 1).maybeSingle();
      if (st && st.news_enabled === false) return json({ ok: true, mode: "news", skipped: "news_disabled" });
    }
    const { data: subs } = await supabase.from("kodus_push_subscriptions").select("*");
    if (!subs?.length) return json({ ok: true, mode: body.news ? "news" : "broadcast", subscriptions: 0, reason: "no_subscriptions" });
    const title = body.news ? `📰 ${body.title ?? "Новость группы"}` : (body.title ?? "KODUS");
    const payload = JSON.stringify({
      title, body: body.body ?? "", icon: "/kodus-icon.png", badge: "/kodus-icon.png",
      tag: body.news ? `news-${body.news_id}` : `broadcast-${Date.now()}`,
      data: body.news ? { newsId: body.news_id } : {}, renotify: true, vibrate: [200,100,200],
    });
    const { results, cleaned } = await sendToSubs(supabase, subs, payload, MESSAGE_TTL);
    return json({ ok: true, mode: body.news ? "news" : "broadcast", subscriptions: subs.length, results, cleaned });
  }

  // Сообщение в чате
  const rec = body?.record ?? body;
  const chat_id = body?.chat_id ?? rec?.chat_id;
  const sender_id = body?.sender_id ?? rec?.user_id;
  const messageBody = body?.body ?? rec?.body;
  if (!chat_id || !sender_id || !messageBody) return json({ error: "Missing required fields" }, 400);

  const { data: members } = await supabase.from("kodus_chat_members").select("user_id").eq("chat_id", chat_id).neq("user_id", sender_id);
  if (!members?.length) return json({ ok: true, reason: "no_recipients" });
  const { data: sender } = await supabase.from("kodus_members").select("full_name").eq("id", sender_id).maybeSingle();
  const { data: subs } = await supabase.from("kodus_push_subscriptions").select("*").in("user_id", members.map((m: any) => m.user_id));
  if (!subs?.length) return json({ ok: true, reason: "no_subscriptions" });
  const payload = JSON.stringify({ title: sender?.full_name ?? "Новое сообщение", body: messageBody, icon: "/kodus-icon.png", badge: "/kodus-icon.png", tag: `msg-${chat_id}`, data: { chatId: chat_id }, vibrate: [200,100,200] });
  const { results, cleaned } = await sendToSubs(supabase, subs, payload, MESSAGE_TTL);
  return json({ ok: true, sent: subs.length - cleaned, cleaned, results });
});