#%%
import numpy as np

"""
    indexing system:
        z/x/y
        counting begins at 1
        z = 1 is most zoomed out
        children are returned in order tl, tr, br, bl
        1/1/1
              2/1/1  2/2/1
              2/1/2  2/2/2
                           3/1/1  3/2/1   3/3/1  3/4/1
                           3/1/2  3/2/2   3/3/2  3/4/2
  
                           3/1/3  3/2/3   3/3/3  3/4/3
                           3/1/4  3/2/4   3/3/4  3/4/4
"""

def bottomRightChild(z, x, y):
    return z+1, 2*x, 2*y

def nthBottomRightChild(n, z, x, y):
    if n == 0:
        return z, x, y
    else:
        brc = bottomRightChild(z, x, y)
        return nthBottomRightChild(n-1, *brc)

def nthTopLeftChild(n, z, x, y):
    zbl, xbl, ybl = nthBottomRightChild(n, z, x, y)
    return zbl, xbl - int(np.power(2, n)), ybl - int(np.power(2, n))

def children(z, x, y):
    br = bottomRightChild(z, x, y)
    br_z, br_x, br_y = br
    bl = br_z, br_x - 1, br_y
    tl = br_z, br_x - 1, br_y - 1
    tr = br_z, br_x,     br_y - 1
    return tl, tr, br, bl

def parent(z, x, y):
    return z-1, int(np.ceil(x/2)), int(np.ceil(y/2))

def nthParent(n, z, x, y):
    if n == 0:
        return z, x, y
    else:
        prnt = parent(z, x, y)
        return nthParent(n-1, prnt)
    

def quadrantContains(parent, child):
    """
        parent === child        ->  True
        Doesn't contain child   ->  False
        In top-left child       ->  "tl"
        In top-right child      ->  "tr"
        In bottom-right child   ->  "br"
        In bottom-left child    ->  "bl"
    """
    pz, px, py = parent
    cz, cx, cy = child

    if pz == cz and px == cx and py == cy:
        return True

    deltaZ = cz - pz
    _, tlx, tly = nthTopLeftChild(deltaZ, pz, px, py)
    _, brx, bry = nthTopLeftChild(deltaZ, pz, px, py)

    x1 = tlx
    x2 = (tlx - brx) / 2
    x3 = brx
    y1 = tly
    y2 = (bry - tly) / 2
    y3 = bry

    direction = ""
    
    if y1 <= cy < y2:
        direction += "t"
    elif y2 <= cy < y3:
        direction += "b"
    else:
        return None
    
    if x1 <= cx < x2:
        direction += "l"
    elif x2 <= cx < x3:
        direction += "r"
    else:
        return None

    return direction




#%%

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



def raster2pyramid(raster, z=1, x=1, y=1):
    rows, cols = raster.shape
    if rows == 1 and cols == 1:
        return Node(z, x, y, raster[0, 0], [])
    else:
        r2 = int(rows/2)
        c2 = int(cols/2)
        tl, tr, br, bl = children(z, x, y)
        topLeft  = raster2pyramid(raster[:r2, :c2], *tl)
        topRight = raster2pyramid(raster[:r2, c2:], *tr)
        botRight = raster2pyramid(raster[r2:, c2:], *br)
        botLeft  = raster2pyramid(raster[r2:, :c2], *bl)
        return Node(z, x, y, None, [topLeft, topRight, botRight, botLeft])


def getSubPyramid(pyramid, z, x, y):
    conts = quadrantContains((pyramid.z, pyramid.x, pyramid.y), (z, x, y))
    if conts == True:
        return pyramid
    if conts == False:
        return None
    if conts == "tl":
        return getSubPyramid(pyramid[0], z, x, y)
    if conts == "tr":
        return getSubPyramid(pyramid[1], z, x, y)
    if conts == "br":
        return getSubPyramid(pyramid[2], z, x, y)
    if conts == "bl":
        return getSubPyramid(pyramid[3], z, x, y)
    raise Exception(f"Unknown case '{conts}'")


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
