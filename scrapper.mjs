import express from "express";
import puppeteer from "puppeteer";
import cheerio from "cheerio";
import cors from "cors";
import fs from "fs";

const app = express();
const port = process.env.PORT || "3000";

app.use(express.json());
app.use(cors({ origin: "*" }));

app.post("/scrap", (req, res) => {
	console.log();
	console.log("STARTING NEW DATA SCRAP");
	console.log(req.body)

	puppeteer
		.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		})
		.then(browser => browser.newPage())
		.then(page => page.goto(req.body.url).then(() => page.content()))
		.then(html => {
			const $ = cheerio.load(html);
			const options = $('.tv-chart-view').data('options');
			const content = JSON.parse(options.content)

			const selectKlinesFrom = new Date(req.body.from);
			const selectKlinesTo = new Date(req.body.to);

			const ideaTzOffset = new Date().toLocaleString('en-US', { timeZone: content.timezone, timeZoneName: 'short' }).slice(-2);
			const tzOffset = req.body.clientTzOffset - Number(ideaTzOffset);

			const selectKlinesFromUTCMs = selectKlinesFrom.getTime() / 1000 + tzOffset * 60 * 60;
			const selectKlinesToUTCMs = selectKlinesTo.getTime() / 1000 + tzOffset * 60 * 60;

			const klines = content.panes[0].sources[0].bars.data.reduce((acc, { value }) => {
				if (value[0] >= selectKlinesFromUTCMs && value[0] <= selectKlinesToUTCMs) {
					return [...acc, {
						t: value[0],
						o: value[1],
						h: value[2],
						l: value[3],
						c: value[4],
					}]
				} else {
					return acc
				}
			}, [])


			fs.writeFile(`scrappings/${options.id}.json`, JSON.stringify({
				id: options.id,
				name: options.name,
				publishedUrl: options.publishedUrl,
				klines,
			}, null, 2), (err) => {
				if (err) throw err;

				console.log()
				console.log(`COMPLETED SAVING ${options.id}.json`);
				console.log()
			})
		})
		.catch(console.error);
});

app.listen(port, '0.0.0.0', () => {
	console.log(`server listening at http://0.0.0.0:${port}`);
});
