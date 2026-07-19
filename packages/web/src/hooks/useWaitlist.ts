import { useState } from 'react';
import { joinWaitlist } from '../api/client';
import { track } from '../lib/analytics';

export function useWaitlist(plan: string) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const openForm = () => {
    track('pro_interest_clicked', { plan });
    setOpen(true);
  };

  const submit = async () => {
    if (!email || submitting) return;
    setSubmitting(true);
    const ok = await joinWaitlist(email, plan);
    setSubmitting(false);
    if (ok) setDone(true);
  };

  return { open, email, setEmail, done, submitting, openForm, submit };
}
