import express from "express";
import puppeteer from "puppeteer";
import cheerio from "cheerio";
import cors from "cors";
import moment from "moment-timezone";
import fs from "fs";

const app = express();
const port = process.env.PORT || "3000";

app.use(express.json());
app.use(cors({ origin: "*" }));

app.post("/scrap", (req, res) => {
	console.log("\nSTARTING NEW DATA SCRAP");
	console.log(req.body)

	puppeteer
		.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
		})
		.then(browser => browser.newPage())
		.then(page => page.goto(req.body.url).then(() => page.content()))
		.then(html => {
			const getData = content => {
				const { panes } =  content.layout === "s" ? content.charts[0] : content
				
				for (let pane in panes) {
					for (let source in panes[pane].sources) {
						if (panes[pane].sources[source].type === "MainSeries") return panes[pane].sources[source].bars.data;
					}
				}
			}

			const $ = cheerio.load(html);
			const options = $('.tv-chart-view').data('options');
			const content = JSON.parse(options.content)
			
			fs.writeFile(`raw-scrappings/${options.id}.json`, JSON.stringify(options, null, 2), err => { if (err) throw err });
			
			const timezone = content.layout === "s" ? content.charts[0].timezone : content.timezone;
			const data = getData(content);
			
			const selectKlinesFrom = moment.tz(req.body.from, timezone).valueOf() / 1000;
			const selectKlinesTo = moment.tz(req.body.to, timezone).valueOf() / 1000;
			
			console.log("IDEA ID:", options.id);
			console.log("IDEA TIMEZONE:", timezone);
			
			const klines = data.reduce((acc, { value }) => {
				if (value[0] >= selectKlinesFrom && value[0] <= selectKlinesTo) {
					return [...acc, {
						t: value[0],
						tf: moment.tz(value[0] * 1000, timezone).format("D MMM YYYY LTS"),
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

				console.log(`COMPLETED SCRAPPING AND SAVING ${options.id}.json \n\n`);
			})
		})
		.catch(console.error)
		.finally(() => res.send());
});

app.listen(port, '0.0.0.0', () => {
	console.log(`server listening at http://0.0.0.0:${port}`);
});
