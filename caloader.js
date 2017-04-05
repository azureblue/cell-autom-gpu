async function loadData(url, responseType) {
    return await new Promise((resolve, reject) => {
        var req = new XMLHttpRequest();
        req.open("GET", url);
        req.responseType = responseType;
        req.onload = () => req.status === 200 ? resolve(req.response) : reject(req.status);
        req.onerror = () => reject(req.status);
        req.send();
    });
}

async function loadCA(configUrl) {
    var json = await loadData(configUrl, "text");
    
    return createCAFromJson(json);
}

async function createCAFromJson(configJson) {
    
    var config = JSON.parse(configJson);

    var datasetsBoards = {};
    
    for (let datasetName of Object.keys(config.datasets)) {
        var dataset = config.datasets[datasetName];
        var w = dataset.width;
        var h = dataset.height;
        var format = dataset.format;
        //hardcoded formats for now
        if (dataset.hasOwnProperty("url")) {
            if (format !== 'bits')
                throw "unsupported format for url: " + format;
            datasetsBoards[datasetName] = await loadBoardFromBinUrl(w, h, dataset.url);
            continue;
        }
        if (format === "random") {
            datasetsBoards[datasetName] = await loadBoardRandom(w, h);
            continue;
        }
        
        throw "invalid dataset config";
    }

    var boardsToLoad = [];
    config.state.forEach(init => {
        var roomPos = new Vec(...init.room);
        roomPos.multiply(config.ca.room.width + 1, config.ca.room.height + 1).add(1, 1);
        var board = datasetsBoards[init.dataset];
        if (board === undefined)
            throw "invalid dataset: " + init.dataset;
        boardsToLoad.push({
            board: board,
            pos: roomPos
        });
    });
    
    var caConfig = CaConfig.fromJsonCaConfig(config.ca);
    caConfig.boardsToLoad = boardsToLoad;
    var ca = new CA(caConfig);

    return ca;
}

async function loadBoardRandom(width, height) {
    var board = new Board(width, height);
    var ar = board.getArray();
    for (var i = 0; i < ar.length; i++)
        ar[i] = randomBool() ? 1 : 0;
    return board;
}

async function loadBoardFromBinUrl(width, height, url) {
    var buffer = await loadData(url, "arraybuffer");
    if (buffer === undefined)
        return undefined;
    var board = new Board(width, height);
    var ar = board.getArray();
    var byteView = new Uint8Array(buffer);
    for (var i = 0; i < ar.length; i++) {
        var byte = i / 8 | 0;
        var bit = i % 8;
        ar[i] = (byteView[byte] >> bit) & 1;
    }
    return board;
}
            