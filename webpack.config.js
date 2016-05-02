module.exports = {
    entry: "./src/main.js",
    output: {
        path: __dirname,
        filename: "mdedit-bundle.js",

        library: ['mdedit'],
        libraryTarget: 'var'
    },
    devtool: 'source-map',
    module: {
        loaders: [
            { test: /\.js$/,
              loader: "babel",
              include: [__dirname + "/src"],
              query: {
                  presets: ['es2015'],
              }
            }
        ]
    }
};

