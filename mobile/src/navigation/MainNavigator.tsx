import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import MatchesScreen from '../screens/matches/MatchesScreen';
import MatchDetailScreen from '../screens/matches/MatchDetailScreen';
import ProposeScreen from '../screens/matches/ProposeScreen';
import ChatScreen from '../screens/matches/ChatScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

export type MainTabParamList = {
  Discover: undefined;
  MatchesStack: {
    screen: keyof MatchesStackParamList;
    params?: MatchesStackParamList[keyof MatchesStackParamList];
  };
  Profile: undefined;
};

export type MatchesStackParamList = {
  MatchesList: undefined;
  MatchDetail: { matchId: string };
  Propose: { matchId: string; responseTo?: string };
  Chat: { matchId: string };
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const MatchesStack = createNativeStackNavigator<MatchesStackParamList>();

function MatchesStackNavigator() {
  return (
    <MatchesStack.Navigator screenOptions={{ headerShown: false }}>
      <MatchesStack.Screen name="MatchesList" component={MatchesScreen} />
      <MatchesStack.Screen name="MatchDetail" component={MatchDetailScreen} />
      <MatchesStack.Screen name="Propose" component={ProposeScreen} />
      <MatchesStack.Screen name="Chat" component={ChatScreen} />
    </MatchesStack.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1453FF',
        tabBarInactiveTintColor: '#475569',
      }}
    >
      <Tab.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          tabBarLabel: 'Discover',
        }}
      />
      <Tab.Screen
        name="MatchesStack"
        component={MatchesStackNavigator}
        options={{
          tabBarLabel: 'Matches',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

