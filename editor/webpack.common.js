const path = require('path');
const webpack = require('webpack');
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

module.exports = (isProduction) => {
  return {
    entry: entry,
    plugins: [
      new MiniCssExtractPlugin({
        filename: isProduction == false ? '[name].css' : '[name].min.css',
        path: path.resolve('dist'),
      }),
      new webpack.SourceMapDevToolPlugin({
        filename: '[name].js.map',
        exclude: [
          /node_modules/,
          /selective_edit/,
        ],
      }),
    ],
    module: {
      rules: [{
          test: /\.js$/,
          exclude: /(node_modules|bower_components)/,
          loader: 'babel-loader',
        },
        {
          test: /\.(sa|sc|c)ss$/,
          use: [
            {
              loader: MiniCssExtractPlugin.loader,
              options: {
                hmr: isProduction == false,
              },
            },
            'css-loader',
            'postcss-loader',
            {
              loader: 'sass-loader',
              options: {
                sassOptions: {
                  includePaths: ['./node_modules']
                },
              }
            }
          ]
        }
      ]
    },
    output: {
      filename: isProduction == false ? '[name].js' : '[name].min.js',
      path: path.resolve('dist'),
    },
  }
};
