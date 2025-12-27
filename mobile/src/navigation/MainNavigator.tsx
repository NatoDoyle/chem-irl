import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import MatchesScreen from '../screens/matches/MatchesScreen';
import MatchDetailScreen from '../screens/matches/MatchDetailScreen';
import ProposeScreen from '../screens/matches/ProposeScreen';
import ChatScreen from '../screens/matches/ChatScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Debug screen - only available in development builds
// Never enable in production, even if EXPO_PUBLIC_ENABLE_DEBUG_MENU is set
const ENABLE_DEBUG_MENU = __DEV__ === true;

let DebugScreen: React.ComponentType<any> | null = null;
if (ENABLE_DEBUG_MENU) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DebugScreen = require('../screens/debug/DebugScreen').default;
}

export type MainTabParamList = {
  Discover: undefined;
  MatchesStack: {
    screen: keyof MatchesStackParamList;
    params?: MatchesStackParamList[keyof MatchesStackParamList];
  };
  Profile: undefined;
  Debug?: undefined; // Optional - only in dev builds
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
      {ENABLE_DEBUG_MENU && DebugScreen && (
        <Tab.Screen
          name="Debug"
          component={DebugScreen}
          options={{
            tabBarLabel: 'Debug',
          }}
        />
      )}
    </Tab.Navigator>
  );
}
