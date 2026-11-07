// Publish fields for a post save. The button pressed decides: "Save draft"
// unpublishes, so the editor must confirm that first on a live post.
export function publishFields(
  publish: boolean,
  existingPublishedAt: string | null | undefined,
  now: string,
): { is_published: boolean; published_at: string | null } {
  return {
    is_published: publish,
    published_at: publish ? (existingPublishedAt ?? now) : null,
  }
}

export function unpublishesLivePost(publish: boolean, wasPublished: boolean): boolean {
  return wasPublished && !publish
}
