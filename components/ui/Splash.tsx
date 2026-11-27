import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors as c, radius as r, spacing as s, type as t } from '@/constants/theme';

const DOT_DELAY = 160;

// Анимированный экран запуска: дышащий логотип с расходящимся ореолом,
// проявляющееся название и прыгающие точки.
export function Splash({ label = 'Проверяем доступ к группе…' }: { label?: string }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const brand = useRef(new Animated.Value(0)).current;
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [
      // Пульс логотипа: плавно растёт и возвращается.
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
      // Ореол: круг расходится от логотипа и растворяется.
      Animated.loop(
        Animated.sequence([
          Animated.timing(halo, { toValue: 1, duration: 1300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(halo, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay(500),
        ]),
      ),
      // Название мягко проявляется при запуске.
      Animated.timing(brand, { toValue: 1, duration: 600, useNativeDriver: true }),
      // Точки прыгают по очереди волной.
      ...dots.map((d, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * DOT_DELAY),
            Animated.timing(d, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(d, { toValue: 0, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          ]),
        ),
      ),
    ];
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, [pulse, halo, brand, dots]);

  const logoScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 0.18, 0] });
  const dotShifts = dots.map(d => d.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }));

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        <Animated.View style={[styles.halo, { transform: [{ scale: haloScale }], opacity: haloOpacity, backgroundColor: c.primary }]} />
        <Animated.View style={[styles.mark, { transform: [{ scale: logoScale }] }]}>
          <Text style={styles.markText}>K</Text>
        </Animated.View>
      </View>
      <Animated.Text style={[styles.brand, { opacity: brand }]}>KODUS</Animated.Text>
      <View style={styles.dotsRow}>
        {dotShifts.map((v, i) => (
          <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: v }], opacity: i === 0 ? 1 : 0.7 }]} />
        ))}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background, gap: s.sm },
  stage: { height: 130, width: 130, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', height: 110, width: 110, borderRadius: 999 },
  mark: { height: 84, width: 84, borderRadius: r.lg, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 40, fontWeight: '800', color: c.white },
  brand: { fontSize: 24, fontWeight: '700', letterSpacing: 6, color: c.text },
  dotsRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  dot: { height: 8, width: 8, borderRadius: 4, backgroundColor: c.primary },
  label: { fontSize: t.small, color: c.muted },
});
