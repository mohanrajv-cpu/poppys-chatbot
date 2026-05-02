import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ChatLayout from '@/components/chat/ChatLayout';

export default async function ChatRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  return <ChatLayout user={user}>{children}</ChatLayout>;
}
