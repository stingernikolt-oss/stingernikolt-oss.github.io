import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKodus } from '@/hooks/useKodus';
import { AccessGate } from '@/components/auth/AccessGate';
import { colors as c } from '@/constants/theme';

export default function TabLayout(){
  const insets=useSafeAreaInsets();
  const {member,chats,readAt,user,preferences}=useKodus();
  const unread=preferences.showUnread
    ?chats.filter(ch=>ch.lastMessage&&ch.lastMessage.user_id!==user?.id&&ch.lastMessage.created_at>(readAt[ch.id]??'')).length
    :0;
  return (
    <AccessGate>
      <Tabs
        screenOptions={{
          headerShown:false,
          tabBarActiveTintColor:c.primary,
          tabBarInactiveTintColor:c.muted,
          tabBarLabelStyle:{fontSize:11,fontWeight:'600',marginBottom:2},
          tabBarStyle:{
            height:Platform.select({ios:insets.bottom+60,android:insets.bottom+60,default:64}),
            paddingTop:6,
            paddingBottom:Platform.select({ios:insets.bottom+8,android:insets.bottom+8,default:8}),
            paddingHorizontal:16,
            backgroundColor:c.surface,
            borderTopWidth:0,
            elevation:0,
          },
          tabBarBadgeStyle:{backgroundColor:c.primary,color:c.white},
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title:'Чаты',
            tabBarBadge:unread||undefined,
            tabBarIcon:({color,size})=><Ionicons name="chatbubbles-outline" color={color} size={size}/>,
          }}
        />
        <Tabs.Screen
          name="members"
          options={{title:'Участники',tabBarIcon:({color,size})=><Ionicons name="people-outline" color={color} size={size}/>}}
        />
        <Tabs.Screen
          name="admin"
          options={{
            title:'Мастер',
            href:member?.role==='master'?undefined:null,
            tabBarIcon:({color,size})=><Ionicons name="shield-checkmark-outline" color={color} size={size}/>,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{title:'Профиль',tabBarIcon:({color,size})=><Ionicons name="person-circle-outline" color={color} size={size}/>}}
        />
      </Tabs>
    </AccessGate>
  );
}
