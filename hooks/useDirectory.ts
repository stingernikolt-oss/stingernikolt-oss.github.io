import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useKodus } from './useKodus';
import * as api from '@/services/kodusService';
export function useDirectory(admin=false) {
 const {user,refreshChats,member}=useKodus(); const router=useRouter(); const [members,setMembers]=useState<api.Member[]>([]); const [query,setQuery]=useState(''); const [filter,setFilter]=useState<'pending'|'approved'|'all'>(admin?'pending':'approved'); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(''); const [error,setError]=useState('');
 const refresh=useCallback(async()=>{if(!user||member?.status!=='approved'||(admin&&member.role!=='master'))return;try{const values=await api.getMembers(admin?undefined:'approved');setMembers(values);setError('');}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить участников.');}finally{setLoading(false);}},[user?.id,member?.status,member?.role,admin]);
 useFocusEffect(useCallback(()=>{void refresh();const timer=setInterval(()=>void refresh(),10000);return()=>clearInterval(timer);},[refresh]));
 const visible=useMemo(()=>members.filter(m=>(admin||m.id!==user?.id)&&(filter==='all'||m.status===filter)&&`${m.full_name} ${m.login}`.toLowerCase().includes(query.trim().toLowerCase())),[members,user?.id,admin,filter,query]);
 const open=useCallback(async(id:string)=>{if(busy)return;setBusy(id);setError('');try{const chatId=await api.openDirect(id);await refreshChats();router.push({pathname:'/chat/[id]',params:{id:chatId}});}catch(e){setError(e instanceof Error?e.message:'Чат недоступен.');}finally{setBusy('');}},[busy,refreshChats,router]);
 const review=useCallback(async(id:string,status:api.MemberStatus)=>{if(busy)return;setBusy(id);setError('');try{await api.reviewMember(id,status);await refresh();await refreshChats();}catch(e){setError(e instanceof Error?e.message:'Не удалось изменить доступ.');}finally{setBusy('');}},[busy,refresh,refreshChats]);
 return {members,visible,query,setQuery,filter,setFilter,loading,busy,error,refresh,open,review};
}
