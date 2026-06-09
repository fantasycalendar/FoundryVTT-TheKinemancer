import { isV12 } from "./is-v12.js";

/** Parse an S3 URL into { bucket, keyPrefix }, or null if not an S3 URL. */
export function parseS3URLCompat(url) {
	if (isV12()) {
		const m = FilePicker.matchS3URL(url);
		return m ? { bucket: m.groups.bucket, keyPrefix: m.groups.key } : null;
	}
	return foundry.applications.apps.FilePicker.implementation.parseS3URL(url);
}
