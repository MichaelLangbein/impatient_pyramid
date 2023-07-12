import numpy as np


class Node:

    def __init__(self, value, children):
        self.value = value
        self.children = children

    def calculate(self, mapFunc, reduceFunc):
        if len(self.children) == 0:
            result = mapFunc(self.value)
            yield { 
                "degree": 1,
                "estimate": result
            }
        else:
            childResults = {}
            for i, child in enumerate(self.children):
                for result in child.calculate(mapFunc, reduceFunc):
                    childResults[i] = result["estimate"]
                    degree = result["degree"] * (i+1) / len(self.children)
                    estimate = reduceFunc(childResults)
                    yield { 
                        "degree": degree,
                        "estimate": estimate
                    }



def raster2pyramid(raster):
    rows, cols = raster.shape
    if rows == 1 and cols == 1:
        return Node(raster[0, 0], [])
    else:
        r2 = int(rows/2)
        c2 = int(cols/2)
        topLeft  = raster2pyramid(raster[:r2, :c2])
        topRight = raster2pyramid(raster[:r2, c2:])
        botRight = raster2pyramid(raster[r2:, c2:])
        botLeft  = raster2pyramid(raster[r2:, :c2])
        return Node(None, [topLeft, topRight, botRight, botLeft])




raster = np.random.random((4, 4))
pyramid = raster2pyramid(raster)

def mapF(val):
    return val

def redF(children):
    vals = [v for v in children.values()]
    return np.mean(vals)

for result in pyramid.calculate(mapF, redF):
    print(result)