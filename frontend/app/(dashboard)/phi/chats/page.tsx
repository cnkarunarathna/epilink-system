import { Suspense } from "react";
import { AllChatsPage } from "@/components/chat/AllChatsPage";

export const metadata = { title: "All Chats — EpiLink" };

export default function PhiChatsPage() {
  return (
    <Suspense>
      <AllChatsPage role="phi" />
    </Suspense>
  );
}
