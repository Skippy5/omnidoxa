import { currentUser } from '@clerk/nextjs/server';
import BriefingForm from './BriefingForm';

export default async function BriefingPage() {
  const user = await currentUser();

  const firstName = user?.firstName ?? '';
  const lastName = user?.lastName ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  return <BriefingForm initialName={fullName} initialEmail={email} />;
}
