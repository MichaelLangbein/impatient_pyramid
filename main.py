#%%
import numpy as np


class Node:

    def __init__(self, z, x, y, value, children):
        self.z = z
        self.x = x
        self.y = y
        self.value = value
        self.children = children

    def calculate(self, mapFunc, reduceFunc):
        """
            mapFunc:    (value,    z, x, y) -> yield {degree, estimate}
            reduceFunc: (children, z, x, y) -> number
        """

        if len(self.children) == 0:
            for result in mapFunc(self.value, self.z, self.x, self.y):
                yield result
        else:
            childResults = {}
            for i, child in enumerate(self.children):
                for result in child.calculate(mapFunc, reduceFunc):
                    childResults[i] = result["estimate"]
                    degree = result["degree"] * (i+1) / len(self.children)
                    estimate = reduceFunc(childResults, self.z, self.x, self.y)
                    yield { 
                        "degree": degree,
                        "estimate": estimate
                    }



def raster2pyramid(raster, z=0, x=0, y=0):
    rows, cols = raster.shape
    if rows == 1 and cols == 1:
        return Node(z, x, y, raster[0, 0], [])
    else:
        r2 = int(rows/2)
        c2 = int(cols/2)
        topLeft  = raster2pyramid(raster[:r2, :c2], z+1, x,   y+1)
        topRight = raster2pyramid(raster[:r2, c2:], z+1, x+1, y+1)
        botRight = raster2pyramid(raster[r2:, c2:], z+1, x+1, y  )
        botLeft  = raster2pyramid(raster[r2:, :c2], z+1, x,   y  )
        return Node(z, x, y, None, [topLeft, topRight, botRight, botLeft])


def getSubPyramid(pyramid, z, x, y):
    if pyramid.z == z and pyramid.x == x and pyramid.y == y:
        return pyramid
    for child in pyramid.children:
        found = getSubPyramid(child, z, x, y)
        if found:
            return found




#%% Test 1: get mean of a single pyramid
raster = np.random.random((4, 4))
pyramid = raster2pyramid(raster)

def mapF(value, z, x, y):
    yield {"estimate": value, "degree": 1}

def redF(children, z, x, y):
    values = [v for v in children.values()]
    return np.mean(values)

for result in pyramid.calculate(mapF, redF):
    print(result)



#%% Test 2: sum two pyramids

raster2 = np.random.random((4, 4))
pyramid2 = raster2pyramid(raster2)



def mapF(val, z, x, y):
    other = getSubPyramid(pyramid, z, x, y)
    
    def mf(val, z, x, y):
        yield {"estimate": val, "degree": 1}
    
    def rf(children, z, x, y):
        values = [v for v in children.values()]
        return np.mean(values)
    
    for otherEstimate in other.calculate(mf, rf):

        yield {
            "estimate": val + otherEstimate["estimate"],
            "degree": otherEstimate["degree"]
        }

def redF(children, z, x, y):
    vals = [v for v in children.values()]
    return np.mean(vals)

for result in pyramid2.calculate(mapF, redF):
    print(result)
# %%
