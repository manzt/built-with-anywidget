import { z } from "zod";
import sharp from "sharp";

let AssetSchema = z.object({
	repo: z.string(),
	bytes: z.instanceof(Uint8Array),
	mimeType: z.enum([
		"image/gif",
		"image/png",
		"image/jpeg",
		"image/svg+xml",
		"application/octet-stream",
	]).transform((v) => {
		if (v === "application/octet-stream") {
			return "image/gif";
		}
		return v;
	}),
});

let repos = JSON.parse(Deno.readTextFileSync("manifest.json"));

for (let repo of repos) {
	if (!repo.sourceUrl) continue;
	let result = await fetch(repo.imageUrl)
		.then(async (response) => AssetSchema.parse({
			...repo,
			mimeType: response.headers.get("content-type"),
			bytes: new Uint8Array(await response.arrayBuffer()),
		}));
	console.log(result);
}
