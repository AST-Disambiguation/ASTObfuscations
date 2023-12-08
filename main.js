const fs = require('fs');
const {parse} = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const generator = require("@babel/generator").default;
const {randoms, base64Encode, native_func} = require('./utils');

function ConfoundUtils(ast, encryptFunc) {
  this.ast = ast;
  this.bigArr = [];
  this.encryptFunc = encryptFunc;
};

/**
 * 修改对象属性访问方式
 * eg: console.log => console["log"]
 */
ConfoundUtils.prototype.changeAccessMode = function () {
  traverse(this.ast, {
    MemberExpression(path) {
      if (t.isIdentifier(path.node.property)) {
        let name = path.node.property.name;
        path.node.property = t.stringLiteral(name);
      }
      path.node.computed = true;
    },
  });
};

/**
 * 标准对象内置处理
 * eg: console["log"] => window["console"]["log"]
 */
ConfoundUtils.prototype.changeBuiltinObjects = function () {
  traverse(this.ast, {
    Identifier(path) {
      let name = path.node.name;
      if (native_func.indexOf(name) !== -1) {
        path.replaceWith(
            t.memberExpression(t.identifier('window'), t.stringLiteral(name),
                true));
      }
    }
  });
};

/**
 * 数字混淆(运算和进制)
 * * 相反的: +,-,*,/,<<,>>
 * * 相同的: ^
 * * * `\`, `&`,
 * todo: 保护强度需要增强
 */
ConfoundUtils.prototype.numericEncrypt = function () {
  // 定义符号映射关系
  const symbolDict = {
    "+": "-", "-": "+", "^": "^", "*": "/", "/": "*"
  }
  const keys = Object.keys(symbolDict);

  traverse(this.ast, {
    NumericLiteral(path) {
      const value = path.node.value, key = parseInt(randoms(0, 1 << 8));
      const symbolKey = keys[Math.floor(Math.random() * keys.length)],
          symbolVal = symbolDict[symbolKey]

      const cipherString = `${value}` + `${symbolKey}` + `${key}`
      const cipherNum = eval(cipherString);
      path.replaceWith(
          t.binaryExpression(symbolVal, t.numericLiteral(cipherNum),
              t.numericLiteral(key)));
      path.skip()
    }
  });
};

/**
 * 字符串混淆与数组抽离
 * todo: 自定义编解码算法
 */
ConfoundUtils.prototype.arrayConfound = function () {
  let bigArr = [];
  let encryptFunc = this.encryptFunc;
  traverse(this.ast, {
    StringLiteral(path) {
      let bigArrIndex = bigArr.indexOf(encryptFunc(path.node.value));
      let index = bigArrIndex;
      if (bigArrIndex === -1) {
        let length = bigArr.push(encryptFunc(path.node.value));
        index = length - 1;
      }
      let encStr = t.callExpression(t.identifier('atob'),
          [t.memberExpression(t.identifier('arr'), t.numericLiteral(index),
              true)]);
      path.replaceWith(encStr);
    }
  });
  bigArr = bigArr.map(function (v) {
    return t.stringLiteral(v);
  });
  this.bigArr = bigArr;
};

/**
 * 数组乱序
 */
ConfoundUtils.prototype.arrayShuffle = function () {
  (function (myArr, num) {
    var arrayShift = function (nums) {
      while (--nums) {
        myArr.unshift(myArr.pop());
      }
    };
    arrayShift(++num);
  }(this.bigArr, 0x10));
};

/**
 * 二项式转为花指令
 * a + b => function(a, b) { return a + b };
 */
ConfoundUtils.prototype.binaryToFunc = function () {
  traverse(this.ast, {
    BinaryExpression(path) {
      let operator = path.node.operator;
      let left = path.node.left;
      let right = path.node.right;
      let a = t.identifier('a');
      let b = t.identifier('b');
      let funcNameIdentifier = path.scope.generateUidIdentifier('xxx');
      let func = t.functionDeclaration(funcNameIdentifier, [a, b],
          t.blockStatement(
              [t.returnStatement(t.binaryExpression(operator, a, b))]));
      let BlockStatement = path.findParent(function (p) {
        return p.isBlockStatement()
      });
      BlockStatement.node.body.unshift(func);
      path.replaceWith(t.callExpression(funcNameIdentifier, [left, right]));
    }
  });
};

/**
 * 十六进制字符串
 */
ConfoundUtils.prototype.stringToHex = function () {
  function hexEnc(code) {
    for (var hexStr = [], i = 0, s; i < code.length; i++) {
      s = code.charCodeAt(i).toString(16);
      hexStr += "\\x" + s;
    }
    return hexStr
  }

  traverse(this.ast, {
    MemberExpression(path) {
      if (t.isIdentifier(path.node.property)) {
        let name = path.node.property.name;
        path.node.property = t.stringLiteral(hexEnc(name));
      }
      path.node.computed = true;
    }
  });
};

/**
 * 标识符混淆
 */
ConfoundUtils.prototype.renameIdentifier = function () {
  //标识符混淆之前先转成代码再解析，才能确保新生成的一些节点也被解析到
  let {code} = generator(this.ast);
  let newAst = parse(code);

  //生成标识符
  function generatorIdentifier(decNum) {
    let arr = ['O', 'o', '0'];
    let retval = [];
    while (decNum > 0) {
      retval.push(decNum % 3);
      decNum = parseInt(decNum / 3);
    }
    let Identifier = retval.reverse().map(function (v) {
      return arr[v]
    }).join('');
    Identifier.length < 6 ? (Identifier = ('OOOOOO' + Identifier).substr(-6))
        : Identifier[0] == '0' && (Identifier = 'O' + Identifier);
    return Identifier;
  }

  function renameOwnBinding(path) {
    let OwnBindingObj = {}, globalBindingObj = {}, i = 0;
    path.traverse({
      Identifier(p) {
        let name = p.node.name;
        let binding = p.scope.getOwnBinding(name);
        binding && generator(binding.scope.block).code == path + ''
            ? (OwnBindingObj[name] = binding) : (globalBindingObj[name] = 1);
      }
    });
    for (let oldName in OwnBindingObj) {
      do {
        var newName = generatorIdentifier(i++);
      } while (globalBindingObj[newName]);
      OwnBindingObj[oldName].scope.rename(oldName, newName);
    }
  }

  traverse(newAst, {
    'Program|FunctionExpression|FunctionDeclaration'(path) {
      renameOwnBinding(path);
    }
  });
  this.ast = newAst;
};

//指定代码行加密
ConfoundUtils.prototype.appointedCodeLineEncrypt = function () {
  traverse(this.ast, {
    FunctionExpression(path) {
      let blockStatement = path.node.body;
      let Statements = blockStatement.body.map(function (v) {
        if (t.isReturnStatement(v)) {
          return v;
        }
        if (!(v.trailingComments && v.trailingComments[0].value
            === 'Base64Encrypt')) {
          return v;
        }
        delete v.trailingComments;
        let {code} = generator(v);
        let cipherText = base64Encode(code);
        let decryptFunc = t.callExpression(t.identifier('atob'),
            [t.stringLiteral(cipherText)]);
        return t.expressionStatement(
            t.callExpression(t.identifier('eval'), [decryptFunc]));
      });
      path.get('body').replaceWith(t.blockStatement(Statements));
    }
  });
};

/**
 * 指定代码行ASCII码混淆
 */
ConfoundUtils.prototype.appointedCodeLineAscii = function () {
  traverse(this.ast, {
    FunctionExpression(path) {
      let blockStatement = path.node.body;
      let Statements = blockStatement.body.map(function (v) {
        if (t.isReturnStatement(v)) {
          return v;
        }
        if (!(v.trailingComments && v.trailingComments[0].value
            === 'ASCIIEncrypt')) {
          return v;
        }
        delete v.trailingComments;
        let {code} = generator(v);
        let codeAscii = [].map.call(code, function (v) {
          return t.numericLiteral(v.charCodeAt(0));
        })
        let decryptFuncName = t.memberExpression(t.identifier('String'),
            t.identifier('fromCharCode'));
        let decryptFunc = t.callExpression(decryptFuncName, codeAscii);
        return t.expressionStatement(
            t.callExpression(t.identifier('eval'), [decryptFunc]));
      });
      path.get('body').replaceWith(t.blockStatement(Statements));
    }
  });
};

/**
 * 逗号表达式
 *
 * 需在平坦流前
 */
ConfoundUtils.prototype.commaConfusion = function () {
  traverse(this.ast, {
    FunctionExpression(path) {
      let blockStatement = path.node.body;
      let blockStatementLength = blockStatement.body.length;
      if (blockStatementLength < 2) {
        return;
      }
      //把所有声明的变量提取到参数列表中
      path.traverse({
        VariableDeclaration(p) {
          declarations = p.node.declarations;
          let statements = [];
          declarations.map(function (v) {
            path.node.params.push(v.id);
            v.init && statements.push(
                t.assignmentExpression('=', v.id, v.init));
          });
          p.replaceInline(statements);
        }
      });
      //处理赋值语句 返回语句 函数调用语句
      let firstSta = blockStatement.body[0], i = 1;
      while (i < blockStatementLength) {
        let tempSta = blockStatement.body[i++];
        t.isExpressionStatement(tempSta) ? secondSta = tempSta.expression
            : secondSta = tempSta;
        //处理返回语句
        if (t.isReturnStatement(secondSta)) {
          firstSta = t.returnStatement(
              t.toSequenceExpression([firstSta, secondSta.argument]));
          //处理赋值语句
        } else if (t.isAssignmentExpression(secondSta)) {
          if (t.isCallExpression(secondSta.right)) {
            let callee = secondSta.right.callee;
            callee.object = t.toSequenceExpression([firstSta, callee.object]);
            firstSta = secondSta;
          } else {
            secondSta.right = t.toSequenceExpression(
                [firstSta, secondSta.right]);
            firstSta = secondSta;
          }
        } else {
          firstSta = t.toSequenceExpression([firstSta, secondSta]);
        }
      }
      path.get('body').replaceWith(t.blockStatement([firstSta]));
    }
  });

};

/**
 * 控制平坦流
 */
ConfoundUtils.prototype.flatFlow = function () {
  traverse(this.ast, {
    FunctionExpression(path) {
      let blockStatement = path.node.body;
      //逐行提取语句，按原先的语句顺序建立索引，包装成对象
      let Statements = blockStatement.body.map(function (v, i) {
        return {index: i, value: v};
      });
      //洗牌，打乱语句顺序
      let i = Statements.length;
      while (i) {
        let j = Math.floor(Math.random() * i--);
        [Statements[j], Statements[i]] = [Statements[i], Statements[j]];
      }
      //构建分发器，创建switchCase数组
      let dispenserArr = [];
      let cases = [];
      Statements.map(function (v, i) {
        dispenserArr[v.index] = i;
        let switchCase = t.switchCase(t.numericLiteral(i),
            [v.value, t.continueStatement()]);
        cases.push(switchCase);
      });
      let dispenserStr = dispenserArr.join('|');
      //生成_array和_index标识符，利用BabelAPI保证不重名
      let array = path.scope.generateUidIdentifier('array');
      let index = path.scope.generateUidIdentifier('index');
      //生成 '...'.split 这是一个成员表达式
      let callee = t.memberExpression(t.stringLiteral(dispenserStr),
          t.identifier('split'));
      //生成 split('|')
      let arrayInit = t.callExpression(callee, [t.stringLiteral('|')]);
      //_array和_index放入声明语句中，_index初始化为0
      let varArray = t.variableDeclarator(array, arrayInit);
      let varIndex = t.variableDeclarator(index, t.numericLiteral(0));
      let dispenser = t.variableDeclaration('let', [varArray, varIndex]);
      //生成switch中的表达式 +_array[_index++]
      let updExp = t.updateExpression('++', index);
      let memExp = t.memberExpression(array, updExp, true);
      let discriminant = t.unaryExpression("+", memExp);
      //构建整个switch语句
      let switchSta = t.switchStatement(discriminant, cases);
      //生成while循环中的条件 !![]
      let unaExp = t.unaryExpression("!", t.arrayExpression());
      unaExp = t.unaryExpression("!", unaExp);
      //生成整个while循环
      let whileSta = t.whileStatement(unaExp,
          t.blockStatement([switchSta, t.breakStatement()]));
      //用分发器和while循环来构建blockStatement，替换原有节点
      path.get('body').replaceWith(t.blockStatement([dispenser, whileSta]));

    }
  });
};

//构建数组声明语句，加入到ast最前面
ConfoundUtils.prototype.unshiftArrayDeclaration = function () {
  this.bigArr = t.variableDeclarator(t.identifier('arr'),
      t.arrayExpression(this.bigArr));
  this.bigArr = t.variableDeclaration('var', [this.bigArr]);
  this.ast.program.body.unshift(this.bigArr);
};

//拼接两个ast的body部分
ConfoundUtils.prototype.astConcatUnshift = function (ast) {
  this.ast.program.body.unshift(ast);
};

ConfoundUtils.prototype.getAst = function () {
  return this.ast;
};

//读取要混淆的代码
const jscode = fs.readFileSync("./demo.js", {
  encoding: "utf-8"
});

//把要混淆的代码解析成ast
let ast = parse(jscode);

//把还原数组乱序的代码解析成astFront
let astFront = parse(
    "(function(myArr,num){var reductionArr=function(nums){while(--nums){myArr.push(myArr.shift());}};reductionArr(++num);})(arr,0x10);");

//初始化类，传递自定义的加密函数进去
let confoundAst = new ConfoundUtils(ast, base64Encode);
let confoundAstFront = new ConfoundUtils(astFront);

//改变对象属性访问方式
confoundAst.changeAccessMode();

//标准内置对象的处理
confoundAst.changeBuiltinObjects();

// 逗号表达式
confoundAst.commaConfusion();

//二项式转函数花指令
confoundAst.binaryToFunc()

//字符串加密与数组混淆
confoundAst.arrayConfound();

//数组乱序
confoundAst.arrayShuffle();

//还原数组顺序代码，改变对象属性访问方式，对其中的字符串进行十六进制编码
confoundAstFront.stringToHex();
astFront = confoundAstFront.getAst();

//先把还原数组顺序的代码，加入到被混淆代码的ast中
confoundAst.astConcatUnshift(astFront.program.body[0]);

//再生成数组声明语句，并加入到被混淆代码的最开始处
confoundAst.unshiftArrayDeclaration();

//标识符重命名
confoundAst.renameIdentifier();

//指定代码行的混淆，需要放到标识符混淆之后
confoundAst.appointedCodeLineEncrypt();
confoundAst.appointedCodeLineAscii();

//数值常量混淆
confoundAst.numericEncrypt();

// 平坦流
confoundAst.flatFlow();
ast = confoundAst.getAst();

//ast转为代码
let {code} = generator(ast, {
  minified: true,
  comments: false,
  retainLines: false,
  compact: true,
  jsescOption: {}
});

//混淆的代码中，如果有十六进制字符串加密，ast转成代码以后会有多余的转义字符，需要替换掉
code = code.replace(/\\\\x/g, '\\x');
fs.writeFileSync('ss_target.js', code, err => {
})