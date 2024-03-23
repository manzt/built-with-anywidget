import { z } from "zod";

type Repo = z.infer<typeof PartialRepoSchema> & { stars: number };

let PartialRepoSchema = z.object({
	repo: z.string(),
	description: z.string(),
	sourceUrl: z.string().url().optional(),
	image: z.string().optional(),
	gif: z.string().optional(),
});

let wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetch_info(
	repo: string,
	options: { token?: string } = {},
) {
	let token = options.token ?? Deno.env.get("GITHUB_TOKEN");
	if (!token) {
		throw Error("Missing GitHub Token");
	}

	let headers = new Headers();
	headers.set("Accept", "application/vnd.github+json");
	headers.set("Authorization", `Bearer ${token}`);
	headers.set("X-GitHub-Api-Version", "2022-11-28");

	let base = new URL("https://api.github.com/repos/");
	let url = new URL(repo, base);
	let response = await fetch(url, { headers });
	let json = await response.json();

	return {
		stars: z.number().parse(json.stargazers_count),
	};
}

if (import.meta.main) {
	let url = new URL("assets/manifest.json", import.meta.url);
	let repos = z.array(PartialRepoSchema).parse(
		await Deno.readTextFile(url).then(JSON.parse),
	);

	let complete: Array<Repo> = [];
	for (let repo of repos) {
		let info = await fetch_info(repo.repo);
		complete.push({ ...repo, stars: info.stars });
		await wait(300);
	}

	await Deno.writeTextFile(
		new URL("assets/manifest-complete.json", import.meta.url),
		JSON.stringify(complete, null, "\t"),
	);
}
