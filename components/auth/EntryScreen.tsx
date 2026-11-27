import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Page } from '@/components/layout/Page';
import { Button, Field, Notice, ui } from '@/components/ui/Primitives';
import { Splash } from '@/components/ui/Splash';
import { useKodus } from '@/hooks/useKodus';
import { colors as c, radius as r, spacing as s } from '@/constants/theme';
export function EntryScreen(){
  const {ready,user,member,profileLoading,profileError,completeProfile,logout}=useKodus();
  const [name,setName]=useState('');
  const [login,setLogin]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  if(!ready||profileLoading)return <Splash/>;
  if(!user)return <Redirect href="/login"/>;
  if(member)return <Redirect href={member.status==='approved'?'/(tabs)':'/pending'}/>;
  const submit=async()=>{setBusy(true);setError('');try{await completeProfile(name,login);}catch(e){setError(e instanceof Error?e.message:'Не удалось создать профиль.');}finally{setBusy(false);}};
  return (
    <Page scroll keyboard bottom narrow>
      <View style={styles.hero}>
        <View style={styles.mark}><Text style={styles.markText}>K</Text></View>
        <Text style={styles.title}>Завершите регистрацию</Text>
        <Text style={[ui.subtle,{textAlign:'center',maxWidth:420}]}>Email подтверждён. Укажите данные для заявки в учебную группу — мастер проверит и откроет доступ.</Text>
      </View>
      <View style={[ui.card,ui.stack]}>
        <Notice message={error||profileError}/>
        <Field label="Фамилия, имя, отчество" value={name} onChangeText={setName} maxLength={120}/>
        <Field label="Уникальный логин" value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false} hint="3–24 символа: латиница, цифры, _" maxLength={24}/>
        <Button label="Отправить заявку" busy={busy} onPress={()=>void submit()}/>
        <Button label="Выйти из аккаунта" tone="secondary" onPress={()=>void logout().catch(e=>setError(e.message))}/>
      </View>
      <View style={{height:s.xl}}/>
    </Page>
  );
}
const styles=StyleSheet.create({hero:{alignItems:'center',gap:s.sm,paddingVertical:s.xl},mark:{height:72,width:72,borderRadius:r.lg,backgroundColor:c.primary,alignItems:'center',justifyContent:'center'},markText:{fontSize:34,fontWeight:'800',color:c.white},title:{fontSize:26,fontWeight:'700',color:c.text,textAlign:'center'}});
