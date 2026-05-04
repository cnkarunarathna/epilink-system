import { Suspense } from "react";
import { AllChatsPage } from "@/components/chat/AllChatsPage";

export const metadata = { title: "All Chats — EpiLink" };

export default function SupervisorChatsPage() {
  return (
    <Suspense>
      <AllChatsPage role="supervisor" />
    </Suspense>
  );
}
