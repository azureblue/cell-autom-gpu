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

    if (config.state.rooms)
        for (let init of config.state.rooms) {
            var roomPos = new Vec(...init.pos);
            var board = await datasetLoader.loadDatasetBoard(init.dataset);
            if (board === undefined)
                throw "invalid dataset: " + init.dataset;
            rooms.push({
                board: board,
                pos: roomPos,
                rule: init.rule
            });
        }
    else if (config.state.roomArray) {
        var raFields = mapFields(config.state.roomArray);
        var raWidth = raFields.get("width");
        var raLen = raWidth * raFields.get("height");
        var rules = raFields.get("rules", () => new Array(raLen).fill(raFields.get("defaultRule")));
        var datasets = raFields.get("datasets", () => new Array(raLen).fill(raFields.get("defaultDataset")));
        for (var i = 0; i < raLen; i++)
            rooms.push({
                board: await datasetLoader.loadDatasetBoard(datasets[i]),
                pos: new Vec(i % raWidth, i / raWidth | 0),
                rule: rules[i]
            });
    } else
        throw "invalid state definition";

    var caConfig = CaConfig.fromJsonCaConfig(config.ca);
    caConfig.rooms = rooms;

    return new CA(caConfig);
}

async function loadBoardRandom(board) {
    var ar = board.getArray();
    for (var i = 0; i < ar.length; i++)
        ar[i] = randomBool() ? 1 : 0;
    return board;
}

async function loadBoardFromBinUrl(width, height, url) {
    var buffer = await loadData(url, "arraybuffer");
    var board = new Board(width, height);
    var ar = board.getArray();
    var byteView = new Uint8Array(buffer);
    //assume no padding for now...
    for (var i = 0; i < ar.length; i++)
        ar[i] = (byteView[i / 8 | 0] >> (7 - i % 8)) & 1;
    
    return board;
}



function DatasetLoader(datasetsConfig) {
    var dataLoader = new DataLoader();
    var datasetBoards = {};
    this.loadDatasetBoard = async function (name) {
        var dataset = mapFields(datasetsConfig).get(name);
        var shared = mapFields(dataset).get("shared", () => true);
        if (datasetBoards[name] === undefined) {
            var board = await load(name);
            if (shared)
                datasetBoards[name] = board;
            return board;
        }

        return datasetBoards[name];
    };

    async function load(datasetName) {
        var dataset = mapFields(datasetsConfig[datasetName]);
        var board = new Board(dataset.get("width"), dataset.get("height"));
        var type = dataset.get("type");
        if (type === "data") {
            await dataLoader.loadBoard(dataset.get("src"), board);
            return board;
        }
        if (type === "random") {
            return loadBoardRandom(board);
        }

        throw "invalid dataset config";
    }
}

function DataLoader() {
    var loadersConfig = {
        bits: {
            dataType: "binary",
            initializer: BitsInitializer
        },
        life105: {
            dataType: "text",
            initializer: Life105Initializer
        }
    };

    this.loadBoard = async function(dataConfing, board) {
        var dataFields = mapFields(dataConfing);
        var format = dataFields.get("format");
        var init = createInitializer(format);
        
        var dataResource;
        if (isDefiened(dataConfing["url"]))
            dataResource = new UrlDataLoader(dataConfing["url"], loadersConfig[format].dataType);
        else if (isDefiened(dataConfing["text"]))
            dataResource = {load: () => dataConfing["text"]};
        else if (isDefiened(dataConfing["textLines"]))
            dataResource = {load: () => dataConfing["textLines"].map(line => line.trim()).join('\n')};
        if (!isDefiened(dataResource))
            throw "invalid data config: " + JSON.stringify(dataConfing);
        
        init.initBoard(board, await dataResource.load());
    };
    
    function createInitializer(name) {
        return new (loadersConfig[name].initializer)();
    }
}

function UrlDataLoader(url, dataType) {
    var responseTypeMap = {
        binary: "arraybuffer",
        text: "text"
    };
    
    this.load = async function() {
        return await loadData(url, responseTypeMap[dataType]);
    };
}

function Life105Initializer() {
    this.initBoard = function(board, text) {
        var posRegex = /(-?\d+)\s*(-?\d+)/;
        var middlePos = new Vec(board.getWidth() / 2 | 0, board.getHeight() / 2 | 0);
        var currentPos = new Vec(...middlePos);
        text.split('\n').map(line => line.trim()).forEach(line => {
            line = line.toLowerCase();
            if (line.startsWith("#p")) {
                var match = posRegex.exec(line);
                currentPos = new Vec(...middlePos).move(new Vec(parseInt(match[1]), parseInt(match[2])));
                return;
            }
            if (line.startsWith("#")) {
                console.warn("ignoring: " + line);
                return;
            }
            if (line.length === 0)
                return;
            if (!/[\*\.]/.test(line))
                throw "invalid line: " + line;
            line.split("").forEach((ch, x) => board.set(currentPos.x + x, currentPos.y, ch === '*' ? 1 : 0));
            currentPos.y++;
        });
    };
}

function BitsInitializer() {
    this.initBoard = function(board, buffer) {
        var ar = board.getArray();
        var byteView = new Uint8Array(buffer);
        //assume no padding for now...
        for (var i = 0; i < ar.length; i++)
        ar[i] = (byteView[i / 8 | 0] >> (7 - i % 8)) & 1;
    };
}

function mapFields(obj) {
    if (!isDefiened(obj))
        throw "obj is undefined";
    return {
        get: function (name, defaultProvider) {
            var value = obj[name];
            if (isDefiened(value))
                return value;
            if (isDefiened(defaultProvider))
                return defaultProvider();
            throw "missing field: " + name;
        }
    };
}

function isDefiened(obj) {
    return obj !== undefined;
}
            