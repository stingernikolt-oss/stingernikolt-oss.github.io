import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useKodus } from '@/hooks/useKodus';
import { Page, Header } from '@/components/layout/Page';
import { Avatar, Badge, Button, Notice, ui } from '@/components/ui/Primitives';
import { Splash } from '@/components/ui/Splash';
import { colors as c, radius as r, spacing as s } from '@/constants/theme';
export function PendingScreen(){
  const {user,member,ready,profileLoading,profileError,refreshMember,logout}=useKodus();
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  if(!ready||profileLoading)return <Splash/>;
  if(!user)return <Redirect href="/login"/>;
  if(!member)return <Redirect href="/"/>;
  if(member.status==='approved')return <Redirect href="/(tabs)"/>;
  const pending=member.status==='pending';
  const refresh=async()=>{setBusy(true);try{await refreshMember();}finally{setBusy(false);}};
  return (
    <Page scroll bottom narrow>
      <Header title="KODUS" subtitle="Закрытая учебная группа"/>
      <View style={styles.hero}>
        <View style={[styles.symbol,pending?{backgroundColor:c.warningSoft}:null]}><Ionicons name={pending?'hourglass-outline':'shield-outline'} size={48} color={pending?c.warning:c.danger}/></View>
        <Badge label={pending?'ЗАЯВКА ОТПРАВЛЕНА':member.status==='blocked'?'ДОСТУП ПРИОСТАНОВЛЕН':'ЗАЯВКА ОТКЛОНЕНА'} tone={pending?'warning':'danger'}/>
        <Text style={styles.title}>{pending?'Вы почти в группе':member.status==='blocked'?'Доступ заблокирован':'Доступ не одобрен'}</Text>
        <Text style={[ui.subtle,{textAlign:'center',maxWidth:420}]}>{pending?'Мастер проверит вашу заявку. Как только он подтвердит участие, чаты откроются автоматически.':'Свяжитесь с мастером учебной группы, чтобы уточнить причину и возможность восстановления доступа.'}</Text>
      </View>
      <View style={[ui.card,ui.row]}>
        <Avatar name={member.full_name} path={member.avatar_path}/>
        <View style={{flex:1}}>
          <Text style={ui.sectionTitle}>{member.full_name}</Text>
          <Text style={ui.subtle}>@{member.login}</Text>
        </View>
      </View>
      <View style={[ui.card,{gap:s.lg,marginTop:s.md}]}>
        <View style={ui.row}><Ionicons name="checkmark-circle-outline" color={c.success} size={22}/><Text style={ui.body}>Email подтверждён</Text></View>
        <View style={ui.row}><Ionicons name="time-outline" color={c.warning} size={22}/><Text style={ui.body}>Одобрение мастером</Text></View>
        <View style={ui.row}><Ionicons name="chatbubbles-outline" color={c.muted} size={22}/><Text style={ui.subtle}>Личные и групповой чаты</Text></View>
      </View>
      <View style={{marginTop:s.lg,gap:s.md}}>
        <Notice message={error||profileError}/>
        <Button label="Проверить статус" icon="refresh-outline" busy={busy} onPress={()=>void refresh()}/>
        <Button label="Редактировать профиль" tone="secondary" onPress={()=>router.push('/profile')}/>
        <Button label="Выйти из аккаунта" tone="secondary" onPress={()=>void logout().catch(e=>setError(e.message))}/>
      </View>
      <View style={{height:s.xl}}/>
    </Page>
  );
}
const styles=StyleSheet.create({hero:{alignItems:'center',paddingVertical:s.xl,gap:s.md},symbol:{height:112,width:112,borderRadius:r.lg,backgroundColor:c.successSoft,alignItems:'center',justifyContent:'center'},title:{fontSize:26,fontWeight:'700',color:c.text,textAlign:'center'}});
