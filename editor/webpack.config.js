const path = require('path');
const readdirRecursive = require('fs-readdir-recursive');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const sourceDir = './source/composite/'
const files = readdirRecursive(sourceDir);
const entry = {};
files.forEach(function(value) {
  if (value.endsWith('.js')) {
    const key = value.substring(0, value.length - 3);
    entry[key] = sourceDir + value;
  } else if (value.endsWith('.sass')) {
    const key = value.substring(0, value.length - 5);
    entry[key] = sourceDir + value;
  }
});

module.exports = {
  mode: 'development',
  entry: entry,
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
      path: path.resolve(__dirname, 'dist'),
    })
  ],
  module: {
    rules: [{
        test: /\.js$/,
        loader: 'babel-loader',
      },
      {
        test: /\.(sa|sc|c)ss$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              hmr: process.env.NODE_ENV === 'development',
            },
          },
          'css-loader',
          'postcss-loader',
          {
            loader: 'sass-loader',
            options: {
              sassOptions: {
                includePaths: ['./node_modules']
              }
            }
          }
        ]
      }
    ]
  }
};
