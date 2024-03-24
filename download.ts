import { z } from "zod";
import sharp from "sharp";

type MimeType = z.infer<typeof AssetSchema>["mimeType"];

function filename(repo: string, mimeType: MimeType) {
	let ext = mimeType === "image/svg+xml" ? "svg" : mimeType.split("/")[1];
	return `${repo.replace("/", "__")}.${ext}`;
}

async function num_pages(gif: Uint8Array) {
	let img = sharp(new Uint8Array(gif!.buffer));
	let meta = await img.metadata();
	return meta.pages ?? 0;
}

let RepoSchema = z.object({
	repo: z.string(),
	description: z.string(),
	sourceUrl: z.string().optional(),
	image: z.string().optional(),
	gif: z.string().optional(),
});

type Asset = z.infer<typeof AssetSchema>;
let AssetSchema = z.object({
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

if (import.meta.main) {
	let repos = z.array(RepoSchema).parse(
		JSON.parse(Deno.readTextFileSync("assets/manifest.json")),
	);
	await Deno.mkdir("assets", { recursive: true });

	let assets = new Map<string, { image: string; gif?: string }>();
	for (let repo of repos) {
		// Already downloaded and converted
		if (repo.gif && repo.image) {
			continue;
		}

		let asset: Asset;
		if (repo.gif && !repo.image) {
			asset = {
				mimeType: "image/gif",
				bytes: Deno.readFileSync(`assets/${repo.gif}`),
			};
		} else if (repo.sourceUrl) {
			asset = await fetch(repo.sourceUrl)
				.then(async (response) =>
					AssetSchema.parse({
						mimeType: response.headers.get("content-type"),
						bytes: new Uint8Array(await response.arrayBuffer()),
					})
				);
		} else {
			// No sourceUrl, no gif, no image
			continue;
		}

		switch (asset.mimeType) {
			case "image/gif": {
				// save both the gif and the middle page as a jpeg
				let npages = await num_pages(asset.bytes);
				// Get the middle page
				let img = sharp(asset.bytes, {
					pages: 1,
					page: Math.floor(npages / 2),
				});
				let imgName = filename(repo.repo, "image/jpeg");
				await img.jpeg().toFile(`assets/${imgName}`);
				let gifName = filename(repo.repo, asset.mimeType);
				Deno.writeFileSync(`assets/${gifName}`, asset.bytes);
				assets.set(repo.repo, { image: imgName, gif: gifName });
				break;
			}
			case "image/png":
			case "image/svg+xml":
			case "image/jpeg": {
				// just save the image
				let imgName = filename(repo.repo, asset.mimeType);
				Deno.writeFileSync(`assets/${imgName}`, asset.bytes);
				assets.set(repo.repo, { image: imgName });
			}
		}
	}

	let completeManifest = repos
		.map((repo) => ({
			repo: repo.repo,
			description: repo.description,
			sourceUrl: repo.sourceUrl,
			image: assets.get(repo.repo)?.image ?? repo.image,
			gif: assets.get(repo.repo)?.gif ?? repo.gif,
		}));

	let finalManifest = JSON.stringify(completeManifest, null, "\t") + "\n";
	Deno.writeTextFileSync("assets/manifest.json", finalManifest);
}
