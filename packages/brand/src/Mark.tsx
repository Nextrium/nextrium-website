import { brand } from './index'
import type { MarkProps } from './types'

/** The selected brand's logo mark. */
export default function Mark(props: MarkProps) {
  const BrandMark = brand.Mark
  return <BrandMark {...props} />
}
