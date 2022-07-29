#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const glob_1 = require("glob");
const Color = require("color");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const JSON5 = require('json5');
const prompts = require('prompts');
prompts.override(require('yargs').argv);
class Colors {
    constructor() {
        this.data = {};
    }
    push(color) {
        const c = Color(color);
        if (c) {
            const key = c.hexa();
            if (this.data[key] === undefined) {
                this.data[key] = { count: 0, varName: '', values: new Set() };
            }
            this.data[key].count += 1;
            this.data[key].values.add(color);
        }
    }
    getData(minCount = 1) {
        const result = {};
        for (const color in this.data) {
            if (this.data[color].count >= minCount) {
                result[color] = this.data[color];
                result[color].values = Array.from(this.data[color].values);
            }
        }
        return result;
    }
    merge(oldData) {
        const result = {};
        for (const color in oldData) {
            if (this.data[color] !== undefined) {
                this.data[color].varName = oldData[color].varName;
            }
        }
        return result;
    }
}
const COLORS = new Colors();
(() => __awaiter(void 0, void 0, void 0, function* () {
    const hexRegex = new RegExp("(#[\\dabcdef]{8})\\b|(#[0-9abcdef]{6})\\b|(#[\\dabcdef]{3})\\b", 'gmui');
    const rgbRegex = new RegExp("(rgb)\\(?(\\s*[01]?\\d\\d?|2[0-4]\\d|25[0-5])(\\W+)([01]?\\d\\d?|2[0-4]\\d|25[0-5])\\W+(([01]?\\d\\d?|2[0-4]\\d|25[0-5]))\\)", 'gmui');
    const rgbaRegex = new RegExp("(rgba)\\(?(\\s*[01]?\\d\\d?|2[0-4]\\d|25[0-5])(\\W+)([01]?\\d\\d?|2[0-4]\\d|25[0-5])\\W+(([01]?\\d\\d?|2[0-4]\\d|25[0-5]))\\W+(([01]?\\d\\d?|2[0-4]\\d|25[0-5]))\\)", 'gmui');
    const hslRegex = new RegExp("hsl\\(\\s*(\\d+)\\s*,\\s*(\\d+(?:\\.\\d+)?%)\\s*,\\s*(\\d+(?:\\.\\d+)?%)\\)", 'gmui');
    const hslaRegex = new RegExp("hsla\\(\\s*(\\d+)\\s*,\\s*(\\d+(?:\\.\\d+)?%)\\s*,\\s*(\\d+(?:\\.\\d+)?%),\\s*(\\d+(?:\\.\\d+)?%)\\)", 'gmui');
    const { action, folder } = yield prompts([
        { name: 'action', type: 'select', message: "Action: parse or replace", choices: [{ title: 'parse', value: 'parse' }, { title: 'replace', value: 'replace' }] },
        { name: 'folder', type: 'text', message: "Folder", initial: "." }
    ]);
    if (action === 'parse') {
        const { minCount } = yield prompts([
            { name: 'minCount', type: 'number', message: "Minimum count colors", min: 1, initial: 1 },
        ]);
        if (typeof folder === 'string') {
            (0, glob_1.glob)("**/*.css", {
                cwd: folder
            }, function (er, files) {
                return __awaiter(this, void 0, void 0, function* () {
                    const PROMISES = [];
                    for (const file of files) {
                        PROMISES.push(new Promise((resolve, reject) => {
                            fs.readFile(path.join(folder, file)).then(r => {
                                const string = r.toString();
                                let m = string.match(hexRegex);
                                if (m) {
                                    m.map((c) => {
                                        COLORS.push(c);
                                    });
                                }
                                m = string.match(rgbRegex);
                                if (m) {
                                    m.map((c) => {
                                        COLORS.push(c);
                                    });
                                }
                                m = string.match(rgbaRegex);
                                if (m) {
                                    m.map((c) => {
                                        COLORS.push(c);
                                    });
                                }
                                m = string.match(hslRegex);
                                if (m) {
                                    m.map((c) => {
                                        COLORS.push(c);
                                    });
                                }
                                m = string.match(hslaRegex);
                                if (m) {
                                    m.map((c) => {
                                        COLORS.push(c);
                                    });
                                }
                                resolve(true);
                            });
                        }));
                    }
                    yield Promise.all(PROMISES);
                    const resultPath = path.join(folder, "colors.json");
                    try {
                        if (yield fs.stat(resultPath)) {
                            const $colors = JSON5.parse((yield fs.readFile(resultPath)).toString());
                            COLORS.merge($colors);
                        }
                    }
                    catch (e) {
                    }
                    yield fs.writeFile(resultPath, JSON.stringify(COLORS.getData(minCount), null, 2));
                    console.log('See results: "' + resultPath + '"');
                    if (os.platform() === 'win32') {
                        const { open } = yield prompts({ name: "open", type: "toggle", message: "open folder?", active: 'yes', inactive: 'no', initial: true, });
                        if (open) {
                            require('child_process').exec('start "" "' + path.dirname(resultPath) + '"');
                        }
                    }
                });
            });
        }
    }
    if (action === 'replace') {
        const _colors = JSON5.parse((yield fs.readFile(path.join(folder, "colors.json"))).toString());
        const $RootCssPath = path.join(folder, "color2var.css");
        const $colors = {};
        const $rootColors = [];
        for (const color in _colors) {
            if (_colors[color].varName.length > 0) {
                $colors[color] = _colors[color];
                $rootColors.push(`--${$colors[color].varName}: ${color};`);
            }
        }
        yield fs.writeFile($RootCssPath, `:root{\n${$rootColors.join("\n")}\n}`);
        console.log($colors);
        (0, glob_1.glob)("**/*.css", {
            cwd: folder
        }, function (er, files) {
            return __awaiter(this, void 0, void 0, function* () {
                for (const file of files) {
                    if (file === "color2var.css") {
                        continue;
                    }
                    const PROMISES = [];
                    PROMISES.push(new Promise((resolve, reject) => {
                        fs.readFile(path.join(folder, file)).then((r) => __awaiter(this, void 0, void 0, function* () {
                            let string = r.toString();
                            for (const color in $colors) {
                                for (const val of $colors[color].values) {
                                    // @ts-ignore
                                    string = string.replaceAll(val, `var(--${$colors[color].varName})`);
                                }
                            }
                            yield fs.writeFile(path.join(folder, file), string);
                            resolve(true);
                        }));
                    }));
                    yield Promise.all(PROMISES);
                }
            });
        });
    }
}))();
//# sourceMappingURL=index.js.map