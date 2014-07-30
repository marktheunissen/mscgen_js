/*
 * takes an abstract syntax tree for a message sequence chart and renders it
 * as an graphviz dot script.
 */

/* jshint node:true */
/* jshint undef:true */
/* jshint unused:strict */

if ( typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(["./flatten", "./textutensils", "./dotmap"], function(flatten, txt, map) {

    var INDENT = "  ";
    var gCounter = 0;

    function _renderAST(pAST) {
        var lRetVal = "graph {\n";
        lRetVal += INDENT + 'rankdir=LR\n';
        lRetVal += INDENT + 'splines=true\n';
        lRetVal += INDENT + 'ordering=out\n';
        lRetVal += INDENT + 'fontname="Helvetica"\n';
        lRetVal += INDENT + 'fontsize="9"\n';
        lRetVal += INDENT + 'node [style=filled, fillcolor=white fontname="Helvetica", fontsize="9" ]\n';
        lRetVal += INDENT + 'edge [fontname="Helvetica", fontsize="9", arrowhead=vee, arrowtail=vee, dir=forward]\n';
        lRetVal += "\n";

        if (pAST) {
            if (pAST.entities) {
                lRetVal += renderEntities(pAST.entities) + "\n";
            }
            if (pAST.arcs) {
                gCounter = 0;
                lRetVal += renderArcLines(pAST.arcs, "");
            }
        }
        return lRetVal += "}";
    }

    /* Attribute handling */
    function renderString(pString) {
        var lStringAry = txt.wrap(pString.replace(/\"/g, "\\\""), 40);
        var lString = lStringAry.slice(0,-1).reduce(function(pPrev, pString){
            return pPrev + pString + "\n";
        }, "");
        lString += lStringAry.slice(-1);
        return lString;
    }

    function pushAttribute(pArray, pAttr, pString) {
        if (pAttr) {
            pArray.push(pString + "=\"" + renderString(pAttr) + "\"");
        }
    }

    function translateAttributes(pThing) {
        var lAttrs = [];
        ["label", "color", "fontcolor", "fillcolor"].forEach(function(pSupportedAttr) {
            pushAttribute(lAttrs, pThing[pSupportedAttr], pSupportedAttr);
        });
        return lAttrs;
    }

    function renderAttributeBlock(pAttrs) {
        var lRetVal = "";
        if (pAttrs.length > 0) {
            lRetVal = pAttrs.slice(0,-1).reduce(function (pPrev, pAttr){
                return pPrev + pAttr + ", ";
            }, " [");
            lRetVal += pAttrs.slice(-1) + "]";
        }
        return lRetVal;
    }

    /* Entity handling */
    function renderEntityName(pString) {
        return "\"" + pString + "\"";
    }

    function renderEntity(pEntity) {
        var lRetVal = "";
        lRetVal += renderEntityName(pEntity.name);
        lRetVal += renderAttributeBlock(translateAttributes(pEntity));
        return lRetVal;
    }

    function renderEntities(pEntities) {
        return pEntities.reduce(function(pPrev, pEntity) {
            return pPrev + INDENT + renderEntity(pEntity) + ";\n";
        }, "");
    }

    /* ArcLine handling */
    function counterizeArc(pArc, pCounter) {
        if (pArc.label) {
            pArc.label = "(" + pCounter + ") " + pArc.label;
        } else {
            pArc.label = "(" + pCounter + ")";
        }
    }

    function renderBoxArc(pArc, pCounter, pIndent) {
        var lRetVal = "";
        var lBoxName = "box" + pCounter.toString();
        lRetVal += lBoxName;
        var lAttrs = translateAttributes(pArc);
        pushAttribute(lAttrs, map.getStyle(pArc.kind), "style");
        pushAttribute(lAttrs, map.getShape(pArc.kind), "shape");

        lRetVal += renderAttributeBlock(lAttrs) + "\n" + INDENT + pIndent;

        lAttrs = [];
        pushAttribute(lAttrs, "dotted", "style");
        pushAttribute(lAttrs, "none", "dir");

        lRetVal += lBoxName + " -- {" + renderEntityName(pArc.from) + "," + renderEntityName(pArc.to) + "}";
        lRetVal += renderAttributeBlock(lAttrs);

        return lRetVal;
    }

    function renderRegularArc(pArc, pAggregatedKind, pCounter) {
        var lRetVal = "";
        counterizeArc(pArc, pCounter);
        var lAttrs = translateAttributes(pArc);

        pushAttribute(lAttrs, map.getStyle(pArc.kind), "style");
        switch(pAggregatedKind) {
            case ("directional") :
                {
                    pushAttribute(lAttrs, map.getArrow(pArc.kind), "arrowhead");
                }
                break;
            case("bidirectional"):
                {
                    pushAttribute(lAttrs, map.getArrow(pArc.kind), "arrowhead");
                    pushAttribute(lAttrs, map.getArrow(pArc.kind), "arrowtail");
                    pushAttribute(lAttrs, "both", "dir");
                }
                break;
            case ("nondirectional"):
                {
                    pushAttribute(lAttrs, "none", "dir");
                }
                break;
        }
        if (!pArc.arcs) {
            lRetVal += renderEntityName(pArc.from) + " ";
            lRetVal += "--";
            lRetVal += " " + renderEntityName(pArc.to);
            lRetVal += renderAttributeBlock(lAttrs);
        }
        return lRetVal;
    }

    function renderSingleArc(pArc, pCounter, pIndent) {
        var lRetVal = "";
        var lAggregatedKind = map.getAggregate(pArc.kind);

        if (lAggregatedKind === "box") {
            lRetVal += renderBoxArc(pArc, pCounter, pIndent);
        } else {
            lRetVal += renderRegularArc(pArc, lAggregatedKind, pCounter);
        }
        return lRetVal;
    }

    function renderArc(pArc, pIndent) {
        var lRetVal = "";

        if (pArc.from && pArc.kind && pArc.to) {
            lRetVal += INDENT + pIndent + renderSingleArc(pArc, ++gCounter, pIndent) + "\n";
            if (pArc.arcs) {
                lRetVal += INDENT + pIndent + "subgraph cluster_" + gCounter.toString() + '{';
                if (pArc.label) {
                    lRetVal += "\n" + INDENT + pIndent + ' label="' + pArc.kind + ": " + pArc.label + '" labeljust="l" \n';
                }
                lRetVal += renderArcLines(pArc.arcs, pIndent + INDENT);
                lRetVal += INDENT + pIndent + "}\n";
            }
        }
        return lRetVal;

    }

    function renderArcLines(pArcLines, pIndent) {
        var lRetVal = "";
        pArcLines.forEach(function(pArcLine){
            pArcLine.forEach(function(pArc){
                lRetVal += renderArc(pArc, pIndent);
            });
        });
        return lRetVal;
    }

    return {
        render : function(pAST) {
            return _renderAST(flatten.dotFlatten(JSON.parse(JSON.stringify(pAST))));
        }
    };
});
/*
 This file is part of mscgen_js.

 mscgen_js is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 mscgen_js is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with mscgen_js.  If not, see <http://www.gnu.org/licenses/>.
 */