/**
 * Task Stack Navigator
 */

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { TaskStackParamList } from "./types";
import { TaskListScreen } from "../screens/tasks/TaskListScreen";
import { TaskDetailScreen } from "../screens/tasks/TaskDetailScreen";
import { EvidenceUploadScreen } from "../screens/tasks/EvidenceUploadScreen";
import { ChatScreen } from "../screens/chat/ChatScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator<TaskStackParamList>();

export const TaskStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.text },
        headerTintColor: colors.primary,
      }}
    >
      <Stack.Screen
        name="TaskList"
        component={TaskListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: "Task Details" }}
      />
      <Stack.Screen
        name="EvidenceUpload"
        component={EvidenceUploadScreen}
        options={{ title: "Add Evidence" }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};
