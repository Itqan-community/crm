import { FormFlow } from '@/components/form/FormFlow';
import { loadActiveFormSchema } from '@/lib/form-schema';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const schema = await loadActiveFormSchema();
  return <FormFlow schema={schema} />;
}
