import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors as c, radius as r, spacing as s } from '@/constants/theme';
import { REACTION_EMOJIS, type ReactionGroup } from '@/services/kodusService';

interface Float { id: number; emoji: string }
let floatId = 0;

export const ReactionPicker = memo(function ReactionPicker({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  return (
    <View style={styles.picker}>
      {REACTION_EMOJIS.map(e => (
        <Pressable key={e} accessibilityRole="button" accessibilityLabel={`Реакция ${e}`} disabled={disabled}
          onPress={() => onPick(e)} style={({ pressed }) => [styles.pickBtn, pressed ? { transform: [{ scale: 1.25 }], backgroundColor: c.primarySoft } : null]}>
          <Text style={styles.pickEmoji}>{e}</Text>
        </Pressable>
      ))}
    </View>
  );
});

interface BarProps { groups: ReactionGroup[]; onToggle: (emoji: string) => void; enabled: boolean; compact?: boolean }
export const ReactionBar = memo(function ReactionBar({ groups, onToggle, enabled, compact }: BarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const pops = useRef<Record<string, Animated.Value>>({});
  const prevCounts = useRef<Record<string, number>>({});

  useEffect(() => {
    groups.forEach(g => {
      const prev = prevCounts.current[g.emoji] ?? g.count;
      if (g.count !== prev) {
        const v = pops.current[g.emoji] ?? (pops.current[g.emoji] = new Animated.Value(1));
        v.setValue(1);
        Animated.sequence([
          Animated.timing(v, { toValue: 1.3, duration: 140, useNativeDriver: true }),
          Animated.spring(v, { toValue: 1, friction: 4, useNativeDriver: true }),
        ]).start();
      }
      prevCounts.current[g.emoji] = g.count;
    });
  }, [groups]);

  const spawn = (emoji: string) => {
    const id = ++floatId;
    setFloats(f => [...f, { id, emoji }]);
    setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 800);
  };
  const toggle = (emoji: string) => { spawn(emoji); onToggle(emoji); };

  if (!enabled && groups.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <View style={[styles.row, compact ? { gap: 4 } : null]}>
        {groups.map(g => {
          const scale = pops.current[g.emoji] ?? new Animated.Value(1);
          return (
            <Animated.View key={g.emoji} style={{ transform: [{ scale }] }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Реакция ${g.emoji}, ${g.count}`} disabled={!enabled}
                onPress={() => toggle(g.emoji)}
                style={({ pressed }) => [styles.chip, g.mine ? styles.chipMine : null, compact ? styles.chipCompact : null, pressed ? { opacity: 0.7 } : null]}>
                <Text style={compact ? { fontSize: 13 } : { fontSize: 15 }}>{g.emoji}</Text>
                <Text style={[styles.count, g.mine ? { color: c.primary } : null]}>{g.count}</Text>
              </Pressable>
            </Animated.View>
          );
        })}
        {enabled ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Добавить реакцию" onPress={() => setPickerOpen(o => !o)}
            style={({ pressed }) => [styles.chip, styles.addChip, compact ? styles.chipCompact : null, pressed ? { opacity: 0.7 } : null]}>
            <Text style={{ fontSize: compact ? 12 : 14, color: c.subtle }}>😊+</Text>
          </Pressable>
        ) : null}
      </View>
      {pickerOpen && enabled ? <ReactionPicker onPick={e => { toggle(e); setPickerOpen(false); }} /> : null}
      <View pointerEvents="none" style={styles.floatLayer}>
        {floats.map(f => <FloatingEmoji key={f.id} emoji={f.emoji} />)}
      </View>
    </View>
  );
});

function FloatingEmoji({ emoji }: { emoji: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 750, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.Text style={{
      fontSize: 22, position: 'absolute', right: 8, bottom: 0,
      opacity: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -56] }) }, { scale: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.6, 1.3, 1] }) }],
    }}>{emoji}</Animated.Text>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: r.pill, backgroundColor: c.raised, borderWidth: 1, borderColor: c.border },
  chipCompact: { paddingHorizontal: 6, paddingVertical: 2 },
  chipMine: { backgroundColor: c.primarySoft, borderColor: c.primary },
  addChip: { borderStyle: 'dashed' },
  count: { fontSize: 12, fontWeight: '700', color: c.subtle },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6, padding: 6, borderRadius: r.sm, backgroundColor: c.raised, borderWidth: 1, borderColor: c.border },
  pickBtn: { height: 38, width: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  pickEmoji: { fontSize: 22 },
  floatLayer: { position: 'absolute', right: 0, bottom: 0, left: 0, height: 0 },
});