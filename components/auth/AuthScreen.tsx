import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useAuthForm } from '@/hooks/useAuthForm';
import { useKodus } from '@/hooks/useKodus';
import { Page } from '@/components/layout/Page';
import { Avatar, Button, Field, Notice, ui } from '@/components/ui/Primitives';
import { colors as c, radius as r, spacing as s } from '@/constants/theme';
export function AuthScreen(){
  const f=useAuthForm();
  const {user,ready}=useKodus();
  if(ready&&user)return <Redirect href="/"/>;
  return (
    <Page scroll keyboard bottom narrow>
      <View style={styles.brandRow}>
        <Image source={require('@/public/kodus-icon.png')} contentFit="cover" transition={200} style={styles.logo}/>
        <Text style={styles.brand}>KODUS</Text>
      </View>
      <View style={[ui.card,ui.stack]}>
        {f.mode!=='verify'?(
          <View style={styles.segments}>
            <Pressable disabled={f.busy} accessibilityRole="button" accessibilityState={{selected:f.mode==='login'}} onPress={()=>f.switchMode('login')} style={({pressed})=>[styles.segment,f.mode==='login'?styles.selected:null,pressed?ui.pressed:null]}>
              <Text style={[styles.segmentText,f.mode==='login'?{color:c.white}:null]}>Вход</Text>
            </Pressable>
            <Pressable disabled={f.busy} accessibilityRole="button" accessibilityState={{selected:f.mode==='register'}} onPress={()=>f.switchMode('register')} style={({pressed})=>[styles.segment,f.mode==='register'?styles.selected:null,pressed?ui.pressed:null]}>
              <Text style={[styles.segmentText,f.mode==='register'?{color:c.white}:null]}>Регистрация</Text>
            </Pressable>
          </View>
        ):null}
        <View style={{gap:s.xs}}>
          <Text style={ui.pageTitle}>{f.mode==='login'?'С возвращением':f.mode==='register'?'Присоединяйтесь к группе':'Подтвердите email'}</Text>
          <Text style={ui.subtle}>{f.mode==='login'?'Войдите, чтобы продолжить общение с группой.':f.mode==='register'?'Создайте аккаунт — доступ откроется после одобрения мастером.':`Введите код из письма на ${f.email}.`}</Text>
        </View>
        {f.mode==='register'?<>
          <Pressable accessibilityRole="button" accessibilityLabel="Выбрать аватар" disabled={f.busy} onPress={()=>void f.chooseAvatar()} style={({pressed})=>[ui.row,pressed?ui.pressed:null]}>
            <Avatar name={f.name} uri={f.avatar?.uri} size={56}/>
            <View style={{flex:1,gap:2}}>
              <Text style={[ui.body,{color:c.primary,fontWeight:'600'}]}>Добавить аватар</Text>
              <Text style={ui.subtle}>JPG, PNG или WebP · до 5 МБ</Text>
            </View>
            <Ionicons name="add-circle-outline" color={c.primary} size={24}/>
          </Pressable>
          <Field label="Фамилия, имя, отчество" placeholder="Ваше ФИО" value={f.name} onChangeText={f.setName} editable={!f.busy} autoCapitalize="words" maxLength={120}/>
          <Field label="Уникальный логин" placeholder="student_name" hint="3–24 символа: латиница, цифры и _" icon="at-outline" value={f.login} onChangeText={f.setLogin} autoCapitalize="none" autoCorrect={false} editable={!f.busy} maxLength={24}/>
        </>:null}
        {f.mode!=='verify'?<>
          <Field label="Email" placeholder="name@college.ru" icon="mail-outline" value={f.email} onChangeText={f.setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!f.busy}/>
          <Field label="Пароль" placeholder="Минимум 6 символов" value={f.password} onChangeText={f.setPassword} secureTextEntry autoComplete={f.mode==='login'?'current-password':'new-password'} editable={!f.busy}/>
          {f.mode==='register'?<Field label="Повторите пароль" placeholder="Ещё раз" value={f.confirm} onChangeText={f.setConfirm} secureTextEntry editable={!f.busy}/>:null}
        </>:<Field label="Код подтверждения" placeholder="0000" value={f.code} onChangeText={f.setCode} keyboardType="number-pad" maxLength={4} autoComplete="one-time-code" editable={!f.busy}/>}
        <Notice message={f.error}/>
        <Notice message={f.notice} success/>
        <Button label={f.mode==='login'?'Войти в KODUS':f.mode==='register'?'Создать аккаунт':'Подтвердить email'} icon="arrow-forward-outline" busy={f.busy} onPress={()=>void f.submit()}/>
        {f.mode==='verify'?<>
          <Button label="Отправить код повторно" tone="secondary" disabled={f.busy} onPress={()=>void f.resend()}/>
          <Button label="Вернуться ко входу" tone="secondary" disabled={f.busy} onPress={()=>f.switchMode('login')}/>
        </>:null}
        <View style={styles.security}>
          <Ionicons name="lock-closed-outline" size={16} color={c.subtle}/>
          <Text style={styles.securityText}>Закрытая группа. Только одобренные участники.</Text>
        </View>
      </View>
      <View style={{height:s.xl}}/>
    </Page>
  );
}
const styles=StyleSheet.create({brandRow:{alignItems:'center',gap:s.sm,paddingVertical:s.xl,flexDirection:'row',justifyContent:'center'},logo:{width:46,height:46,borderRadius:r.sm},brand:{fontSize:26,fontWeight:'800',letterSpacing:3,color:c.text},segments:{height:48,padding:4,flexDirection:'row',borderRadius:r.sm,backgroundColor:c.raised},segment:{flex:1,borderRadius:8,justifyContent:'center',alignItems:'center'},selected:{backgroundColor:c.primary},segmentText:{fontSize:14,color:c.subtle,fontWeight:'600'},security:{flexDirection:'row',alignItems:'center',gap:s.sm},securityText:{flex:1,fontSize:12,lineHeight:19,color:c.subtle}});
