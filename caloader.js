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
    let datasetLoader = new DatasetLoader(config.datasets);

    var rooms = [];
    for (let init of config.state) {
        var roomPos = new Vec(...init.room);
        var board = await datasetLoader.loadDatasetBoard(init.dataset);
        if (board === undefined)
            throw "invalid dataset: " + init.dataset;
        rooms.push({
            board: board,
            pos: roomPos,
            rule: init.rule
        });
    }
    
    var caConfig = CaConfig.fromJsonCaConfig(config.ca);
    caConfig.rooms = rooms;
    
    return new CA(caConfig);
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

function DatasetLoader(datasetsConfig) {
    var datasets = {};
    this.loadDatasetBoard = async function (datasetName) {
        if (datasets[datasetName] === undefined)
            datasets[datasetName] = load(datasetName);
        
        return await datasets[datasetName];        
    };
    
    function load(datasetName) {
        var dataset = datasetsConfig[datasetName];
        var w = dataset.width;
        var h = dataset.height;
        var format = dataset.format;
        //hardcoded formats for now
        if (dataset.hasOwnProperty("url")) {
            if (format !== 'bits')
                throw "unsupported format for url: " + format;
            return loadBoardFromBinUrl(w, h, dataset.url);
        }
        if (format === "random") {
            return loadBoardRandom(w, h);
        }
        
        throw "invalid dataset config";
    };
}
            