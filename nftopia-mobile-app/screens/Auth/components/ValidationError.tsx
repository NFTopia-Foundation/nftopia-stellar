// Re-export the shared validation message so the Auth screens keep their
// historical import path while the implementation lives with the other shared
// form primitives in `components/ui`.
export { default } from '@/components/ui/ValidationError';
export type { ValidationErrorProps } from '@/components/ui/ValidationError';
