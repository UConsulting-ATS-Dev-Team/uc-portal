-- Real content-moderation capability for /admin/content, closing a
-- genuine gap: feed_posts/interview_writeups/library_contributions only
-- ever had own-row delete (feed_posts_delete_own, etc.) -- an admin could
-- not remove another member's inappropriate post, write-up, or
-- contribution at all. The Admin Dashboard's "Moderate feed" link has
-- pointed at a fully fake FLAGGED_FEED_POSTS=2 constant (data/mockAdmin.js)
-- with no real backing and no real moderation action behind it.
create policy "feed_posts_admin_delete" on feed_posts for delete using (is_admin());
create policy "interview_writeups_admin_delete" on interview_writeups for delete using (is_admin());
create policy "library_contributions_admin_delete" on library_contributions for delete using (is_admin());
