# react-native-sortable-multilist Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## 1.1.0

- `disableLongPress` - Allow disabling of long press interaction, to be used in conjunction with `enableRightDragArea`.
- `enableRightDragArea` - Due to the zIndex issue, when items are moved around using `transform.translateY`, the draw order doesn't change so items further down the list are still drawn on top of the earlier items, this blocks `onPress` interactions on items, so manually dragging an item based on an immediate onPress breaks. The workaround is to define an immediate draggable area (the fifth right portion of an item's width),
- `rightDragAreaOffsets` - Used to further define the active area using a width and right margin.

## 1.0.3

- More README.md updates and package version bump.

## 1.0.2

- README.md updates - no significant changes

## 1.0.0

- First release of `react-native-sortable-multilist`
