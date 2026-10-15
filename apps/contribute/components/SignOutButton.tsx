import { signOut } from '@/app/actions/auth'

export default function SignOutButton({ className = 'btn-outline', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <form action={signOut}>
      <button type="submit" className={className} style={{ fontSize: 13, cursor: 'pointer', ...style }}>
        Sign out
      </button>
    </form>
  )
}
