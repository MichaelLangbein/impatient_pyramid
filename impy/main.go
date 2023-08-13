package main

import (
	"fmt"
	"math/rand"

	"github.com/uber/h3-go/v4"
)

type IGrid interface {
	isBottom(location h3.Cell) bool
	getChildren(location h3.Cell) map[string]h3.Cell
}

type Estimate[T any] struct {
	degree   float32
	estimate T
}

type EstimateStream[T any] chan Estimate[T]

type IPyramid[T any] interface {
	getEstimateStreamAt(location h3.Cell) EstimateStream[T]
}

type MapFunc[T any] func(args []any, loc h3.Cell) T

type AggregateFunc[T any] func(args map[string]T, loc h3.Cell) T

type Pyramid[T any] struct {
	grid          IGrid
	mapFunc       MapFunc[T]
	aggregateFunc AggregateFunc[T]
	inputs        []Pyramid[any]
}

func (pyramid *Pyramid[T]) GetEstimateStreamAt(location h3.Cell) EstimateStream[T] {

}

func (pyramid *Pyramid[T]) pyramidEstimate(location h3.Cell) EstimateStream[T] {

}

type H3Grid struct {
	minZoom int
	maxZoom int
}

func (h3g *H3Grid) isBottom(location h3.Cell) bool {
	res := location.Resolution()
	if res <= h3g.maxZoom {
		return true
	}
	return false
}

func (h3g *H3Grid) getChildren(location h3.Cell) {
	h3.
}

func main() {

	poi := h3.LatLngToCell(h3.LatLng{Lat: 52, Lng: 14}, 10)

	g := H3Grid{minZoom: 4, maxZoom: 14}

	mf := func(args []any, loc h3.Cell) int {
		return rand.Int()
	}
	af := func(args map[string]int, loc h3.Cell) int {
		var mean int = 0
		for _, val := range args {
			mean += val
		}
		return mean / len(args)
	}
	inp := make([]Pyramid[any], 0)
	p := Pyramid[int]{grid: g, mapFunc: mf, aggregateFunc: af, inputs: inp}
	stream := p.GetEstimateStreamAt(poi)

	for estimate := range stream {
		fmt.Print(estimate)
	}

}
