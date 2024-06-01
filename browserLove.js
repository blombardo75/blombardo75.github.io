async function readJson(url) {
    let response = await fetch(url)
    return await response.json();
}

async function readText(url, extraData = {}) {
    let response = await fetch(url, extraData)
    return await response.text();
}

async function getRepo() {
    let response = await readJson('https://api.github.com/repos/blombardo75/browser-love/git/trees/main?recursive=1');
    let paths = response.tree.filter(t => t.type=='blob').map(t => t.path);
    var repoContents = {};
    paths.forEach(path => repoContents[path] = false);

    var repo = {};

    repo.isInRepo = function(path) {
        return path in repoContents
    }
    
    repo.getFromRepo = async function (path) {
        if (repoContents[path]===false) {
            var s = await readText(`https://raw.githubusercontent.com/blombardo75/browser-love/main/${path}`);
            s = s.replaceAll('import(', 'import2(')
            repoContents[path] = s
        }
        return repoContents[path]
    }

    return repo;
}

function getFetch(repo) {
    return async function(...args) {
        if (args.length==1 && repo.isInRepo(args[0])) {
            console.log('SUCCESS', args[0])
            return {'text': () => repo.getFromRepo(args[0])}
        } else {
            console.log('FAIL', ...args)
            return fetch(...args)
        }
    }
}

async function moduleFromJsString(str) {
    var innerStr = "data:text/javascript;base64," + btoa(str);
    fullCode = `import("${innerStr}")`
    return await iWind2.eval(fullCode);
}

function getImport(repo) {
    return async function(arg) {
        if (arg[0]=='/') {
            arg = arg.slice(1)
        }
        if (repo.isInRepo(arg)) {
            console.log('SUCCESS', arg);
            var result = await moduleFromJsString(await repo.getFromRepo(arg));
            return result;
        } else {
            console.log('FAIL', arg)
            return import(arg)
        }
    }
}

async function setupIframe() {
    iWind2 = document.getElementById('browserLove').contentWindow;
    var repo = await getRepo();
    iWind2.fetch = getFetch(repo);
    iWind2.import2 = getImport(repo);

    let iframeHtml = await repo.getFromRepo('index.html');
    while(iframeHtml.includes('<script src=')) {
        let firstFileStart = iframeHtml.indexOf('<script src=')+13;
        let firstFileEnd = iframeHtml.indexOf(iframeHtml[firstFileStart-1], firstFileStart);
        let firstFile = iframeHtml.slice(firstFileStart, firstFileEnd);
        iframeHtml = iframeHtml.replace(`<script src=${iframeHtml[firstFileStart-1]}${firstFile}${iframeHtml[firstFileStart-1]}></script>`, `<script>${await repo.getFromRepo(firstFile)}</script>`)
    }
    while(iframeHtml.includes('<link rel="stylesheet" href=')) {
        let firstFileStart = iframeHtml.indexOf('<link rel="stylesheet" href=')+29;
        let firstFileEnd = iframeHtml.indexOf(iframeHtml[firstFileStart-1], firstFileStart);
        let firstFile = iframeHtml.slice(firstFileStart, firstFileEnd);
        iframeHtml = iframeHtml.replace(`<link rel="stylesheet" href=${iframeHtml[firstFileStart-1]}${firstFile}${iframeHtml[firstFileStart-1]}>`, `<style>${await repo.getFromRepo(firstFile)}</style>`)
    }
    iframeHtml = iframeHtml.replace(".src = 'iframeScript.js';", `.src = 'data:text/javascript;base64,${btoa(await repo.getFromRepo('iframeScript.js'))}'`)
    iframeHtml = iframeHtml.replace('</body>', '<script>doneLoading=true;</script></body>')
    iframeHtml = iframeHtml.replace("//readFile('canvasTest2.js').then(runSource);", "readFile('canvasTest2.js').then(runSource);");
    iframeHtml = iframeHtml.replace("luaToJS('main.lua').then(runSource);", "//luaToJS('main.lua').then(runSource);")
    iWind2.document.write(iframeHtml)
    while (!iWind2.doneLoading) {}
    iWind2.onload();
}

window.onload = async (event) => {
    await setupIframe();
    let iframe = document.getElementById('browserLove');
	iframe.width = iframe.contentWindow.document.body.scrollWidth;
	iframe.height = iframe.contentWindow.document.body.scrollHeight+16;
}