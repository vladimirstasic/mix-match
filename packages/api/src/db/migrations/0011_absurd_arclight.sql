CREATE INDEX "analyses_user_id_idx" ON "analyses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "analyses_slug_idx" ON "analyses" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "follows_follower_id_idx" ON "follows" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "segments_analysis_id_idx" ON "segments" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "votes_segment_id_idx" ON "votes" USING btree ("segment_id");