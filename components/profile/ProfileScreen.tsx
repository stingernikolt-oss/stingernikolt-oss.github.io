import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useKodus } from '@/hooks/useKodus';
import { useProfileForm } from '@/hooks/useProfileForm';
import { AccessGate } from '@/components/auth/AccessGate';
import { Page, Header } from '@/components/layout/Page';
import { Avatar, Badge, Button, Field, Notice, ui } from '@/components/ui/Primitives';
import { colors as c, radius as r, spacing as s } from '@/constants/theme';
export function ProfileScreen({tab=false}:{tab?:boolean}){return <AccessGate allowPending><ProfileContent tab={tab}/></AccessGate>;}
function ProfileContent({tab}:{tab:boolean}){
  const {member,user}=useKodus();
  const f=useProfileForm();
  const router=useRouter();
  return (
    <Page scroll keyboard bottom={!tab} narrow>
      <Header title="Мой профиль" subtitle="Как вас видит учебная группа" back={!tab}/>
      <View style={styles.identity}>
        <Pressable accessibilityRole="button" accessibilityLabel="Изменить аватар" onPress={()=>void f.choose()} style={({pressed})=>[styles.avatarWrap,pressed?ui.pressed:null]}>
          <Avatar name={member?.full_name??''} path={member?.avatar_path} uri={f.asset?.uri} size={96}/>
          <View style={styles.camera}><Ionicons name="camera-outline" size={18} color={c.white}/></View>
        </Pressable>
        <Text style={styles.name}>{member?.full_name}</Text>
        <Text style={styles.login}>@{member?.login}</Text>
        <View style={ui.row}>
          <Badge label={member?.role==='master'?'Мастер группы':'Участник группы'}/>
          <Badge label={member?.status==='approved'?'Доступ открыт':member?.status==='pending'?'Ожидает одобрения':'Доступ закрыт'} tone={member?.status==='approved'?'success':'warning'}/>
        </View>
      </View>
      <View style={[ui.card,ui.stack]}>
        <Text style={ui.sectionTitle}>Личные данные</Text>
        <Field label="Фамилия, имя, отчество" value={f.name} onChangeText={f.setName} maxLength={120} editable={!f.busy}/>
        <Field label="Логин" value={`@${member?.login??''}`} editable={false} hint="Уникальный логин закреплён за аккаунтом."/>
        <Field label="Email" value={user?.email??''} editable={false} icon="mail-outline"/>
        <Notice message={f.error}/>
        <Notice message={f.saved?'Профиль сохранён. Изменения видны участникам группы.':''} success/>
        <Button label="Сохранить изменения" busy={f.busy} onPress={()=>void f.save()}/>
      </View>
      <View style={[ui.card,{gap:s.md,marginTop:s.md}]}>
        <View style={ui.row}><Ionicons name="shield-checkmark-outline" color={c.primary} size={24}/><Text style={ui.sectionTitle}>Ваш аккаунт</Text></View>
        <Text style={ui.subtle}>В группе с {member?new Date(member.created_at).toLocaleDateString('ru-RU'):''}. Email доступен только вам, ФИО и аватар — одобренным участникам.</Text>
        <Button label="Настройки аккаунта" tone="secondary" icon="settings-outline" onPress={()=>router.push('/settings')}/>
      </View>
      <View style={{height:s.xl}}/>
    </Page>
  );
}
const styles=StyleSheet.create({identity:{alignItems:'center',gap:10,paddingVertical:s.lg},avatarWrap:{position:'relative'},camera:{position:'absolute',right:0,bottom:0,backgroundColor:c.primary,borderRadius:r.pill,height:32,width:32,alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:c.background},name:{fontSize:24,fontWeight:'700',color:c.text,textAlign:'center'},login:{fontSize:15,color:c.primary,fontWeight:'600'}});
