/**
 * Navigation type definitions
 */

import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, RouteProp } from "@react-navigation/native";

// Root Stack Navigator
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
};

// Auth Stack Navigator
export type AuthStackParamList = {
  Login: undefined;
};

// Main Bottom Tab Navigator
export type MainTabParamList = {
  Home: undefined;
  Tasks: { screen?: string; params?: any } | undefined;
  TaskMap: undefined;
  RiskMap: undefined;
  Route: undefined;
  Profile: undefined;       // hidden from tab bar — navigated via home avatar
  Notifications: undefined; // hidden from tab bar — navigated via bell icon
};

// Task Stack Navigator (nested in Tasks tab)
export type TaskStackParamList = {
  TaskList: undefined;
  TaskDetail: { taskId: string };
  Camera: { taskId: string };
  EvidenceReview: { taskId: string };
  EvidenceUpload: { taskId: string };
  TaskMap: undefined;
  Chat: { taskId: string; taskTitle: string; isReadOnly?: boolean };
};

// Navigation prop types
export type RootStackNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;
export type AuthStackNavigationProp =
  NativeStackNavigationProp<AuthStackParamList>;
export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;
export type TaskStackNavigationProp =
  NativeStackNavigationProp<TaskStackParamList>;

// Combined navigation props for nested navigators
export type TaskScreenNavigationProp = CompositeNavigationProp<
  TaskStackNavigationProp,
  MainTabNavigationProp
>;

// Route prop types
export type TaskDetailRouteProp = RouteProp<TaskStackParamList, "TaskDetail">;
export type CameraRouteProp = RouteProp<TaskStackParamList, "Camera">;
export type EvidenceReviewRouteProp = RouteProp<
  TaskStackParamList,
  "EvidenceReview"
>;
export type EvidenceUploadRouteProp = RouteProp<
  TaskStackParamList,
  "EvidenceUpload"
>;
