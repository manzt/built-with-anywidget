import sharp from "npm:sharp";
let repos = JSON.parse(Deno.readTextFileSync("assets/repos.json"));

let gif: undefined | typeof repos[0] = undefined;
for (let repo of repos) {
	if (!repo.imageUrl) continue;

	let result = await fetch(repo.imageUrl)
		.then(async (response) => ({
			...repo,
			content_type: response.headers.get("content-type"),
			buffer: await response.arrayBuffer(),
		}));

	if (result.content_type === "image/gif") {
		gif = result;
		break;
	}
}

async function getPages(gif: Uint8Array) {
	let img = sharp(new Uint8Array(gif!.buffer));
	let meta = await img.metadata();
	return meta.pages ?? 0;
}

let pages = await getPages(new Uint8Array(gif!.buffer));
let img = sharp(new Uint8Array(gif!.buffer), {
	pages: 1,
	page: Math.floor(pages / 2)
});
img.toFile("output.png");
