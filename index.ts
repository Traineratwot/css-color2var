#!/usr/bin/env node
import {glob}     from "glob";
import * as Color from "color";
import * as fs    from "fs/promises";
import * as path  from "path";
import * as os    from "os";

const JSON5   = require('json5')
const prompts = require('prompts');
prompts.override(require('yargs').argv);

type ColorData = { [k: string]: { count: number, varName: string, values: Set<string> } }

class Colors {
	public data: ColorData = {}

	push(color: string) {
		const c = Color(color)
		if (c) {
			const key = c.hexa()
			if (this.data[key] === undefined) {
				this.data[key] = {count: 0, varName: '', values: new Set()}
			}
			this.data[key].count += 1
			this.data[key].values.add(color)
		}
	}

	getData(minCount = 1) {
		const result = {}
		for (const color in this.data) {
			if (this.data[color].count >= minCount) {
				result[color]        = this.data[color]
				result[color].values = Array.from(this.data[color].values)
			}
		}
		return result
	}

	merge(oldData: ColorData) {
		const result = {}
		for (const color in oldData) {
			if (this.data[color] !== undefined) {
				this.data[color].varName = oldData[color].varName
			}
		}
		return result
	}
}

const COLORS = new Colors();

(async () => {

	const hexRegex = new RegExp("(#[\\dabcdef]{8})\\b|(#[0-9abcdef]{6})\\b|(#[\\dabcdef]{3})\\b", 'gmui')

	const rgbRegex  = new RegExp("(rgb)\\(?(\\s*[01]?\\d\\d?|2[0-4]\\d|25[0-5])(\\W+)([01]?\\d\\d?|2[0-4]\\d|25[0-5])\\W+(([01]?\\d\\d?|2[0-4]\\d|25[0-5]))\\)", 'gmui')
	const rgbaRegex = new RegExp("(rgba)\\(?(\\s*[01]?\\d\\d?|2[0-4]\\d|25[0-5])(\\W+)([01]?\\d\\d?|2[0-4]\\d|25[0-5])\\W+(([01]?\\d\\d?|2[0-4]\\d|25[0-5]))\\W+(([01]?\\d\\d?|2[0-4]\\d|25[0-5]))\\)", 'gmui')
	const hslRegex  = new RegExp("hsl\\(\\s*(\\d+)\\s*,\\s*(\\d+(?:\\.\\d+)?%)\\s*,\\s*(\\d+(?:\\.\\d+)?%)\\)", 'gmui')
	const hslaRegex = new RegExp("hsla\\(\\s*(\\d+)\\s*,\\s*(\\d+(?:\\.\\d+)?%)\\s*,\\s*(\\d+(?:\\.\\d+)?%),\\s*(\\d+(?:\\.\\d+)?%)\\)", 'gmui')

	const {action, folder} = await prompts([
											   {name: 'action', type: 'select', message: "Action: parse or replace", choices: [{title: 'parse', value: 'parse'}, {title: 'replace', value: 'replace'}]},
											   {name: 'folder', type: 'text', message: "Folder", initial: "C:\\Projects\\css-color2var\\test"}
										   ]);
	if (action === 'parse') {
		const {minCount} = await prompts([
											 {name: 'minCount', type: 'number', message: "Minimum count colors", min: 1, initial: 1},
										 ]);
		if (typeof folder === 'string') {
			glob("**/*.css", {
				cwd: folder
			}, async function (er, files) {
				const PROMISES = []
				for (const file of files) {
					PROMISES.push(new Promise((resolve, reject) => {
						fs.readFile(path.join(folder, file)).then(r => {
							const string = r.toString()
							let m        = string.match(hexRegex)
							if (m) {
								m.map((c) => {
									COLORS.push(c)
								})
							}
							m = string.match(rgbRegex)
							if (m) {
								m.map((c) => {
									COLORS.push(c)
								})
							}
							m = string.match(rgbaRegex)
							if (m) {
								m.map((c) => {
									COLORS.push(c)
								})
							}
							m = string.match(hslRegex)
							if (m) {
								m.map((c) => {
									COLORS.push(c)
								})
							}
							m = string.match(hslaRegex)
							if (m) {
								m.map((c) => {
									COLORS.push(c)
								})
							}
							resolve(true)
						})
					}))
				}
				await Promise.all(PROMISES)
				const resultPath = path.join(folder, "colors.json")
				try {
					if (await fs.stat(resultPath)) {
						const $colors: ColorData = JSON5.parse((await fs.readFile(resultPath)).toString())
						COLORS.merge($colors)
					}
				} catch (e) {

				}
				await fs.writeFile(resultPath, JSON.stringify(COLORS.getData(minCount), null, 2))
				console.log('See results: "' + resultPath + '"')
				if (os.platform() === 'win32') {
					const {open} = await prompts({name: "open", type: "toggle", message: "open folder?", active: 'yes', inactive: 'no', initial: true,});
					if (open) {
						require('child_process').exec('start "" "' + path.dirname(resultPath) + '"');
					}
				}
			})
		}
	}
	if (action === 'replace') {
		const _colors: ColorData = JSON5.parse((await fs.readFile(path.join(folder, "colors.json"))).toString())
		const $RootCssPath       = path.join(folder, "color2var.css")
		const $colors            = {}
		const $rootColors        = []
		for (const color in _colors) {
			if (_colors[color].varName.length > 0) {
				$colors[color] = _colors[color]
				$rootColors.push(`--${$colors[color].varName}: ${color};`)
			}
		}
		await fs.writeFile($RootCssPath, `:root{\n${$rootColors.join("\n")}\n}`)
		console.log($colors)
		glob("**/*.css", {
			cwd: folder
		}, async function (er, files) {
			for (const file of files) {
				if (file === "color2var.css") {
					continue;
				}
				const PROMISES = []
				PROMISES.push(new Promise((resolve, reject) => {
					fs.readFile(path.join(folder, file)).then(async r => {
						let string = r.toString()

						for (const color in $colors) {
							for (const val of $colors[color].values) {
								// @ts-ignore
								string = string.replaceAll(val, `var(--${$colors[color].varName})`);
							}
						}

						await fs.writeFile(path.join(folder, file), string)
						resolve(true)
					})
				}))
				await Promise.all(PROMISES)
			}
		})
	}
})()