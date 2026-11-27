import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors as c } from '@/constants/theme';
import type { ConnectionStatus } from '@/hooks/useConnectionStatus';

// Салатовый — «в сети», оранжевый — «подключение…», красный — «не в сети».
const COLORS: Record<ConnectionStatus,string> = { online:'#8BC34A', connecting:c.warning, offline:c.danger };

// Точка статуса: ставится на нижний правый край аватарки, с ободком цвета фона.
export function PresenceDot({status,size=12}:{status:ConnectionStatus;size?:number}){
  return <View style={{position:'absolute',right:-1,bottom:-1,width:size,height:size,borderRadius:size/2,backgroundColor:COLORS[status],borderWidth:2,borderColor:c.background}}/>;
}

// Обёртка: кладёт точку на угол любой аватарки — <PresenceAvatar status={connection}><Avatar .../></PresenceAvatar>
export function PresenceAvatar({status,children}:{status:ConnectionStatus;children:ReactNode}){
  return <View style={styles.wrap}>{children}<PresenceDot status={status}/></View>;
}

const styles = StyleSheet.create({ wrap:{alignSelf:'flex-start'} });
