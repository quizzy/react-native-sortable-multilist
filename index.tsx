// imports {{{
import { equals } from 'ramda';
import * as React from 'react';
import {
  Dimensions,
  findNodeHandle,
  Platform,
  StyleSheet,
  UIManager,
} from 'react-native';
import {
  FlatList,
  LongPressGestureHandler,
  PanGestureHandler,
  State as GestureState,
  TapGestureHandler,
  // @ts-ignore - peer dependency
} from 'react-native-gesture-handler';
// @ts-ignore - peer dependency
import Animated, { Easing } from 'react-native-reanimated';
import { getStatusBarHeight } from 'react-native-status-bar-height';
// }}}

// global vars {{{
const isIOS = Platform.OS === 'ios';
const { height: winHeight } = Dimensions.get('window');
const iPhoneXFullScreenHeight = 812;
const iPhoneXMaxFullScreenHeight = 896;
const isIPhoneX =
  isIOS &&
  (winHeight === iPhoneXFullScreenHeight ||
    winHeight === iPhoneXMaxFullScreenHeight);
const iPhoneXBottomInset = 34;
const statusBarHeight = !isIOS ? getStatusBarHeight() : 0;
// }}}

// Animated {{{
const {
  event,
  block,
  eq,
  neq,
  set,
  Value,
  call,
  cond,
  add,
  sub,
  lessThan,
  lessOrEq,
  greaterThan,
  greaterOrEq,
  and,
  or,
  divide,
  multiply,
  onChange,
  round,
  Clock,
  timing,
  startClock,
  stopClock,
  clockRunning,
  interpolate,
} = Animated;
// }}}

// styled-components {{{
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
    width: '100%',
  },
  flexContainerOverflow: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
});

// }}}

// types {{{
type RenderItem = (props: any) => JSX.Element;
type DataType = object[] | object[][];
interface ItemBoundaries {
  top: number;
  bottom: number;
}
type RenderHeader = () => JSX.Element;

interface Props {
  data: DataType;
  renderItem: RenderItem | RenderItem[];
  keyExtractor: (item: object, index: number) => string;
  renderHeader?: RenderHeader | RenderHeader[];
  updateListOnDragEnd?: (list: DataType) => void;
  disableUpdateListDebounce?: boolean;
  updateListDebounceDuration?: number;
  ref?: React.Ref<any>;
  disableAutoUpdate?: boolean;
}

interface MappedItemType {
  arrayIndex: number;
  draggableId: number;
  draggableIdValue: Animated.Value<number>;
  itemTranslateY: Animated.Value<number>;
  itemKey: number;
}

interface State {
  containerHeight: number;
  itemHeights: number[];
  itemBoundaries: ItemBoundaries[];
  scrollSpeed: number;
  dataWithId: MappedItemType[];
  isDataMultipleLists: boolean;
  largestItemHeight: number;
}
// }}}

// helper functions {{{
const getIsDataMultipleLists = (data: DataType): boolean =>
  Array.isArray(data[0]);

const setUpInitialData = (data: DataType): MappedItemType[] => {
  const isDataMultipleLists = getIsDataMultipleLists(data);

  if (isDataMultipleLists) {
    const flatData = data.reduce((acc, arr, arrayIndex) => {
      return [
        ...acc,
        ...arr.map((item, itemIndex) => ({
          ...item,
          arrayIndex,
          draggableId: acc.length + itemIndex,
          draggableIdValue: new Value(acc.length + itemIndex),
          itemTranslateY: new Value(0),
          itemKey: acc.length + itemIndex,
        })),
      ];
    }, []);
    // @ts-ignore - TODO fix this weird lint error
    return flatData;
  }

  const dataWithId = (data as object[]).map((item, index) => {
    return {
      ...item,
      draggableId: index,
      draggableIdValue: new Value(index),
      arrayIndex: 0,
      itemTranslateY: new Value(0),
      itemKey: index,
    };
  });
  return dataWithId;
};

const mapItemBoundaries = (
  itemHeights: number[],
  itemOffsets: number[],
  firstItemIds: number[],
) => (item: any, index: number): ItemBoundaries => {
  const { arrayIndex } = item;
  const itemHeight = itemHeights[arrayIndex];
  const offset = itemOffsets[arrayIndex];
  const firstItemIndex = firstItemIds[arrayIndex];

  const offsetIndex = index - firstItemIndex;

  const top = offsetIndex * itemHeight + offset;
  const bottom = top + itemHeight;

  return { top, bottom };
};

// }}}

export class SortableMultilist extends React.Component<Props, State> {
  // State {{{
  public state = {
    containerHeight: 0,
    itemHeights: [0],
    itemBoundaries: [],
    scrollSpeed: 0,
    dataWithId: setUpInitialData(this.props.data),
    isDataMultipleLists: getIsDataMultipleLists(this.props.data),
    largestItemHeight: 0,
  };
  // }}}

  // {{{defaultProps
  public static defaultProps = {
    disableUpdateListDebounce: false,
    updateListDebounceDuration: 3000,
    disableAutoUpdate: false,
  };
  // }}}

  // class helper methods {{{
  public mapFirstItemsIds = () => {
    if (!this.state.isDataMultipleLists) {
      return [0, 1];
    }

    const { data } = this.props;

    return (data as object[][]).reduce(
      (final: [], array: [], index: number, dataArray: object[][]) => {
        if (index === 0) {
          return [0];
        }

        const previousIndex = index - 1;
        return [
          ...final,
          final[previousIndex] + dataArray[previousIndex].length,
        ];
      },
      [],
    );
  }

  public mapLastItemIds = () => {
    const { data } = this.props;

    if (!this.state.isDataMultipleLists) {
      return [data.length - 1, 0];
    }

    return (data as object[][]).reduce(
      (final: [], array: [], index: number, dataArray: object[][]) => {
        if (index === 0) {
          return [array.length - 1];
        }

        return [...final, array.length + final[index - 1]];
      },
      [],
    );
  }

  public mapFirstItemRefs = () => {
    if (!this.state.isDataMultipleLists) {
      // @ts-ignore think View doesn't exist :shrug:
      return [React.createRef<Animated.View>()];
    }

    return (this.props.data as object[][]).map(() =>
      // @ts-ignore think View doesn't exist :shrug:
      React.createRef<Animated.View>(),
    );
  }

  public mapItemArraysIds = (firstItemIds) => {
    const arrayIds = firstItemIds.map((item, index) => index);
    return arrayIds;
  }

  public mapActiveHoverZones = (firstItemIds) => {
    const defaultZone = { top: 0, bottom: 0 };
    const activeHoverZones = this.firstItemIds.map(() => defaultZone);
    return activeHoverZones;
  }

  public mapHeaderRefs = () => {
    if (!this.props.renderHeader) {
      return null;
    }

    if (typeof this.props.renderHeader === 'function') {
      // @ts-ignore think View doesn't exist :shrug:
      return [React.createRef<Animated.View>()];
    }
    const refs = this.props.renderHeader.map((renderFn) => {
      if (typeof renderFn === 'function') {
        // @ts-ignore think View doesn't exist :shrug:
        return React.createRef<Animated.View>();
      }
      return null;
    });
    return refs;
  }

  public resetClassVariables = () => {
    this.scrollEnabled = true;
    this.hasAutoScrollStartedValue.setValue(0);
    this.isAutoScrollDownValue.setValue(0);
    this.isAutoScrollUpValue.setValue(0);
    this.activeItemIndex = -1;
    this.activeItemIndexValue.setValue(-1);
    this.activeItemArrayIndexValue.setValue(-1);
    this.activeHoverIndex = -1;
    this.activeHoverIndexValue.setValue(-1);
    this.activeHoverArrayIndexValue.setValue(-1);
    this.activeHoverArrayIndex = -1;
    this.manualTriggerValue.setValue(-1);
    this.manualTriggerIndex = -1;
    this.activeHoverOutOfBoundsValue.setValue(0);
    this.activeHoverZoneValue.setValue(-1);
    this.touchOutOfBoundsValue.setValue(0);
    this.touchOutOfBoundsTopValue.setValue(0);
    this.touchOutOfBoundsBottomValue.setValue(0);
    this.isSavingValue.setValue(0);
  }

  // Called externally from parent using ref
  public getListForSaving = () => {
    const { data } = this.props;
    const { isDataMultipleLists } = this.state;

    const dataToSave = isDataMultipleLists
      ? (data as object[][]).map((list, index) => {
          const updatedList = this.dataWithProps
            .filter((item) => item.arrayIndex === index)
            .map((item) => {
              const {
                arrayIndex,
                draggableId,
                itemKey,
                itemTranslateY,
                draggableIdValue,
                ...cleansedItem
              } = item;
              return cleansedItem;
            });
          return updatedList;
        })
      : this.dataWithProps.reduce((final, item) => {
          const {
            arrayIndex,
            draggableId,
            itemKey,
            itemTranslateY,
            draggableIdValue,
            ...cleansedItem
          } = item;
          return [...final, cleansedItem];
        }, []);

    return dataToSave;
  }

  public updateListOnDragEnd = () => {
    const {
      data,
      updateListOnDragEnd,
      updateListDebounceDuration,
      disableUpdateListDebounce,
      disableAutoUpdate,
    } = this.props;

    const dataToSave = this.getListForSaving();
    this.dataToSave = dataToSave;

    if (
      equals(data, this.dataToSave) ||
      disableAutoUpdate ||
      !updateListOnDragEnd
    ) {
      return;
    }

    if (disableUpdateListDebounce) {
      updateListOnDragEnd(dataToSave);
      return;
    }

    clearTimeout(this.updateListTimeout);
    this.updateListTimeout = setTimeout(() => {
      updateListOnDragEnd(dataToSave);
    }, updateListDebounceDuration);
  }

  // }}}

  // class vars {{{
  public flatListRef = React.createRef<FlatList<any>>();
  public tapRef = React.createRef<TapGestureHandler>();
  public longPressRef = React.createRef<LongPressGestureHandler>();
  public panGestureRef = React.createRef<PanGestureHandler>();
  public firstItemRefs = this.mapFirstItemRefs();
  public headerRefs = this.mapHeaderRefs();
  public firstItemIds = this.mapFirstItemsIds();
  public lastItemIds = this.mapLastItemIds();
  public itemArrayIds = this.mapItemArraysIds(this.firstItemIds);
  public itemOffsets = this.firstItemIds.map(() => 0);
  public activeHoverZones = this.mapActiveHoverZones(this.firstItemIds);
  public autoScrollResolve: (params: number[]) => void;

  public updateListTimeout = null;
  public dataWithProps = this.state.dataWithId;
  public dataToSave = this.props.data;

  public initialSetupFinished = 0;
  public activeItemIndex = -1;
  public activeItemArrayIndex = -1;
  public activeHoverIndex = -1;
  public activeHoverArrayIndex = -1;
  public scrollEnabled = true;
  public manualTriggerIndex = -1;

  public initialSetUpFinishedValue = new Value(0);
  public isSavingValue = new Value(0);
  public manualTriggerValue = new Value(-1);
  public longPressStateValue = new Value(0);
  public tapStateValue = new Value(0);
  public gestureStateValue = new Value(0);
  public gestureOldStateValue = new Value(0);
  public containerHeightValue = new Value(0);
  public containerOffsetTopValue = new Value(0);
  public containerLowerBoundValue = new Value(0);
  public containerUpperBoundValue = new Value(0);
  public contentTotalHeightValue = new Value(0);
  public hiddenContentHeightValue = new Value(0);
  public pointerY = new Value(0);
  public scrollTopValue = new Value(0);
  public scrollTopLowerBoundValue = new Value(0);
  public autoScrollTargetValue = new Value(0);
  public hasAutoScrollStartedValue = new Value(0);
  public hasScrollTopMatchedTargetValue = new Value(0);
  public isAutoScrollDownValue = new Value(0);
  public isAutoScrollUpValue = new Value(0);
  public activeItemIndexValue = new Value(-1);
  public activeHoverIndexValue = new Value(-1);
  public activeItemArrayIndexValue = new Value(-1);
  public activeHoverArrayIndexValue = new Value(-1);
  public lastItemIndexValue = new Value(0);
  public touchOutOfBoundsValue = new Value(0);
  public touchOutOfBoundsTopValue = new Value(0);
  public touchOutOfBoundsBottomValue = new Value(0);
  public activeHoverOutOfBoundsValue = new Value(0);
  public activeHoverZoneValue = new Value(-1);

  public itemHeightValues = this.state.isDataMultipleLists
    ? (this.props.data as object[][]).map(() => new Value(0))
    : [new Value(0), new Value(1)];

  // }}}

  // componentDidUpdate {{{
  public componentDidUpdate(prevProps: Props) {
    if (prevProps.data !== this.props.data && this.activeItemIndex === -1) {
      if (equals(this.props.data, this.dataToSave)) {
        return;
      }

      // only setState if the data is different
      const isDataMultipleLists = getIsDataMultipleLists(this.props.data);
      const dataWithId = setUpInitialData(this.props.data);
      this.dataWithProps = dataWithId;
      this.dataToSave = this.props.data;
      this.setState({ dataWithId, isDataMultipleLists });
    }
  }
  // }}}

  // getReorderedData {{{
  public getReorderedData = () => {
    const { dataWithProps } = this;

    if (this.activeHoverIndex === -1 || this.activeHoverArrayIndex === -1) {
      return dataWithProps;
    }

    const { arrayIndex: activeItemArrayIndex } = dataWithProps[
      this.activeItemIndex
    ];

    if (activeItemArrayIndex !== this.activeHoverArrayIndex) {
      return dataWithProps;
    }

    const dataWithoutActive = dataWithProps.filter(
      (item) => item.draggableId !== this.activeItemIndex,
    );

    const head =
      this.activeHoverIndex === 0
        ? []
        : dataWithoutActive.slice(0, this.activeHoverIndex);
    const tail = dataWithoutActive.slice(this.activeHoverIndex);
    const updatedDataList = [
      ...head,
      dataWithProps[this.activeItemIndex],
      ...tail,
    ];

    const remappedIds = updatedDataList.map((item, index) => ({
      ...item,
      draggableId: index,
      draggableIdValue: new Value(index),
    }));

    return remappedIds;
  }
  // }}}

  // Flatlist onLayout {{{
  public handleFlatListLayout = async ({ nativeEvent }) => {
    const {
      layout: { height },
    } = nativeEvent;
    const { itemHeights, isDataMultipleLists } = this.state;

    // Measure the FlatList's offset from the top of the root view
    const flatListOffsetTop: number = await new Promise(
      async (resolve, reject) => {
        await UIManager.measure(
          findNodeHandle(this.flatListRef.current),
          async (x, y, w, h, px, py) => {
            resolve(py);
          },
        );
      },
    );

    if (this.initialSetupFinished === 0) {
      const isReady = await new Promise((resolve) => {
        const lastIndex = this.firstItemRefs.length - 1;
        if (this.firstItemRefs[lastIndex].current) {
          resolve(true);
          return;
        }
        resolve(false);
      });

      if (!isReady) {
        setTimeout(() => this.handleFlatListLayout({ nativeEvent }), 50);
        return;
      }
    }

    // Measure firstItem heights
    const itemHeightResolves: Array<
      PromiseLike<number>
    > = this.firstItemRefs.map(
      (ref) =>
        new Promise((resolve, reject) => {
          UIManager.measure(findNodeHandle(ref.current), (x, y, w, h) =>
            resolve(h),
          );
        }),
    );
    const updatedItemHeights: number[] = await Promise.all(itemHeightResolves);

    const headerHeightResolves: Array<PromiseLike<number>> = this.headerRefs
      ? this.headerRefs.map(
          (header) =>
            new Promise((resolve, reject) => {
              if (header === null || header.current === null) {
                return resolve(0);
              }

              UIManager.measure(findNodeHandle(header.current), (x, y, w, h) =>
                resolve(h || 0),
              );
            }),
        )
      : null;

    const updatedHeaderHeights: number[] = headerHeightResolves
      ? await Promise.all(headerHeightResolves)
      : [0];

    if (!equals(updatedItemHeights, itemHeights)) {
      const largestItemHeight = updatedItemHeights.reduce(
        (final, current) => (current > final ? current : final),
        0,
      );
      const scrollSpeed = largestItemHeight;
      const actualSpeed = Math.round(isIOS ? scrollSpeed : scrollSpeed * 0.1);
      const itemBoundaryOffset = largestItemHeight;
      const requiresOffset =
        isIPhoneX &&
        [iPhoneXFullScreenHeight, iPhoneXMaxFullScreenHeight].includes(height);
      // iPhoneX requires some weird hack when the component takes up the entire screen
      const bottomInset = requiresOffset ? iPhoneXBottomInset : 0;
      const topInset = requiresOffset ? 0 : flatListOffsetTop + statusBarHeight;
      this.containerHeightValue.setValue(height);
      this.containerLowerBoundValue.setValue(
        // @ts-ignore // AnimatedNode lint error - unexpected number
        topInset + height - bottomInset - itemBoundaryOffset,
      );
      this.containerUpperBoundValue.setValue(
        // @ts-ignore // AnimatedNode lint error - unexpected number
        flatListOffsetTop + itemBoundaryOffset + statusBarHeight,
      );
      this.containerOffsetTopValue.setValue(
        // @ts-ignore // AnimatedNode lint error - unexpected number
        flatListOffsetTop + statusBarHeight,
      );

      this.itemHeightValues.forEach((itemHeightValue, index) => {
        const itemHeight =
          updatedItemHeights[index] || updatedItemHeights[index - 1]; // this only happens for a flat list data
        // @ts-ignore // AnimatedNode lint error - unexpected number
        itemHeightValue.setValue(itemHeight);
      });

      this.itemOffsets = this.firstItemIds.map((draggableId, firstItemId) => {
        if (!this.state.isDataMultipleLists && firstItemId > 0) {
          return 0;
        }

        const offset = [...Array(firstItemId)]
          .map(
            (ignore, innerIndex) =>
              (this.firstItemIds[innerIndex + 1] -
                this.firstItemIds[innerIndex]) *
              updatedItemHeights[innerIndex],
          )
          .reduce((acc, current) => acc + current, 0);

        const headerOffsets = [...Array(firstItemId + 1)]
          .map((ignore, innerIndex) => {
            const headerOffset = updatedHeaderHeights[innerIndex];
            return headerOffset ? headerOffset : 0;
          })
          .reduce((acc, current) => acc + current, 0);

        return offset + headerOffsets;
      });

      // Bounding boxes
      const boundaryMapper = mapItemBoundaries(
        updatedItemHeights,
        this.itemOffsets,
        this.firstItemIds,
      );
      // const updatedItemBoundaries = dataWithId.map(boundaryMapper);
      const updatedItemBoundaries = this.dataWithProps.map(boundaryMapper);

      const totalHeaderHeights = updatedHeaderHeights.reduce(
        (final, current) => final + current,
        0,
      );
      const contentTotalHeight =
        totalHeaderHeights +
        updatedItemHeights.reduce((final, current, index) => {
          const { data } = this.props;
          const dataLength = this.state.isDataMultipleLists
            ? (data as object[][])[index].length
            : data.length;
          return final + current * dataLength;
        }, 0);

      const updatedActiveHoverZones = this.itemArrayIds.map((arrayId) => {
        if (!isDataMultipleLists && arrayId > 0) {
          return {
            top: contentTotalHeight,
            bottom: contentTotalHeight,
          };
        }
        const top = this.itemOffsets[arrayId];
        const bottom =
          this.itemOffsets[arrayId + 1] - updatedHeaderHeights[arrayId + 1] ||
          contentTotalHeight;
        return { top, bottom };
      });

      this.activeHoverZones = updatedActiveHoverZones;

      // @ts-ignore // AnimatedNode lint error - unexpected number
      this.contentTotalHeightValue.setValue(contentTotalHeight);
      // @ts-ignore // AnimatedNode lint error - unexpected number
      this.hiddenContentHeightValue = sub(
        this.contentTotalHeightValue,
        this.containerHeightValue,
      );

      // @ts-ignore // AnimatedNode lint error - unexpected number
      this.lastItemIndexValue.setValue(this.dataWithProps.length - 1);
      // this.lastItemIndexValue.setValue(dataWithId.length - 1);

      this.setState(
        {
          containerHeight: height,
          itemHeights: updatedItemHeights,
          itemBoundaries: updatedItemBoundaries,
          scrollSpeed: actualSpeed,
          largestItemHeight,
        },
        () => {
          this.initialSetupFinished = 1;
          // @ts-ignore // AnimatedNode lint error - unexpected number
          this.initialSetUpFinishedValue.setValue(1);
        },
      );
    }
  }
  // }}}

  // calculateActiveItem {{{
  public calculateActiveItem = (
    initialY: number,
    scrollTop: number,
    containerOffsetTop: number,
  ) => {
    const { itemBoundaries } = this.state;
    const touchY = initialY - containerOffsetTop + scrollTop;

    const currentActiveItemIndex = itemBoundaries.reduce(
      (final, bounds, index) => {
        const { top, bottom } = bounds;

        if (touchY > top && touchY < bottom) {
          return index;
        }

        return final;
      },
      -1,
    );

    return currentActiveItemIndex;
  }
  // }}}

  // Manual Trigger from renderedItem {{{
  public manualStartDrag = (activeItemIndex) => {
    // @ts-ignore doesn't think setNativeProps is present
    this.flatListRef.current.setNativeProps({
      scrollEnabled: false,
    });

    this.manualTriggerValue.setValue(activeItemIndex);
    this.manualTriggerIndex = activeItemIndex;

    const { arrayIndex } = this.dataWithProps[activeItemIndex];
    // @ts-ignore Animated setValue
    this.activeItemArrayIndexValue.setValue(arrayIndex);
    this.activeItemArrayIndex = arrayIndex;
  }

  public handleManualTriggerChange = (params: number[]) => {
    const [state, manualTrigger] = params;

    if (state === GestureState.BEGAN) {
      clearTimeout(this.updateListTimeout);
      const { itemKey: itemKeyInitial } = this.state.dataWithId[manualTrigger];
      const mappedTriggerId = this.dataWithProps.findIndex(
        ({ itemKey }) => itemKey === itemKeyInitial,
      );
      // @ts-ignore Animated setValue
      this.activeItemIndexValue.setValue(mappedTriggerId);
      this.activeItemIndex = mappedTriggerId;

      this.scrollEnabled = false;
    }
  }

  public handleTapStateChange = (params: number[]) => {
    const [state, manualTrigger] = params;
    if (state === GestureState.END && manualTrigger > -1) {
      // @ts-ignore doesn't think setNativeProps is present
      this.flatListRef.current.setNativeProps({ scrollEnabled: true });
      this.resetClassVariables();
      const { disableUpdateListDebounce, disableAutoUpdate } = this.props;
      if (!disableAutoUpdate && !disableUpdateListDebounce) {
        this.updateListOnDragEnd();
      }
    }
  }
  // }}}

  // onTapStateChange {{{
  public onTapStateChange = event([
    {
      nativeEvent: ({ state, absoluteY }) =>
        cond(
          and(eq(this.initialSetUpFinishedValue, 1), eq(this.isSavingValue, 0)),
          [
            set(this.tapStateValue, state),
            onChange(this.manualTriggerValue, [
              cond(
                and(
                  neq(this.manualTriggerValue, -1),
                  eq(state, GestureState.BEGAN),
                ),
                [
                  set(this.pointerY, absoluteY),
                  call(
                    [this.tapStateValue, this.manualTriggerValue],
                    this.handleManualTriggerChange,
                  ),
                ],
              ),
            ]),
            onChange(
              this.tapStateValue,
              call(
                [this.tapStateValue, this.manualTriggerValue],
                this.handleTapStateChange,
              ),
            ),
          ],
        ),
    },
  ]);
  // }}}

  // handleLongPressActive {{{
  public handleLongPressActive = (params: number[]) => {
    const [
      touchY,
      scrollTop,
      containerOffsetTop,
      manualTrigger,
      isSaving,
    ] = params;

    if (isSaving) {
      return;
    }

    if (manualTrigger === -1) {
      const activeItemIndex = this.calculateActiveItem(
        touchY,
        scrollTop,
        containerOffsetTop,
      );

      if (activeItemIndex === -1) {
        return;
      }

      // cancel save timeout
      clearTimeout(this.updateListTimeout);

      // @ts-ignore
      this.flatListRef.current.setNativeProps({
        scrollEnabled: false,
      });
      this.scrollEnabled = false;

      this.activeItemIndex = activeItemIndex;
      this.activeItemIndexValue.setValue(activeItemIndex);

      const { arrayIndex } = this.dataWithProps[activeItemIndex];

      // @ts-ignore Animated setValue
      this.activeItemArrayIndexValue.setValue(arrayIndex);
      this.activeItemArrayIndex = arrayIndex;
    }
  }

  public handleLongPressCancelled = () => {
    // @ts-ignore
    this.flatListRef.current.setNativeProps({ scrollEnabled: true });
    this.resetClassVariables();
    const { disableAutoUpdate, disableUpdateListDebounce } = this.props;
    if (!disableAutoUpdate && !disableUpdateListDebounce) {
      this.updateListOnDragEnd();
    }
  }

  // }}}

  // onLongPress {{{
  public onLongPress = event([
    {
      nativeEvent: ({ state, absoluteY, oldState }) =>
        block([
          cond(
            and(
              eq(this.initialSetUpFinishedValue, 1),
              eq(this.isSavingValue, 0),
            ),
            [
              set(this.longPressStateValue, state),
              onChange(this.longPressStateValue, [
                cond(eq(this.longPressStateValue, GestureState.ACTIVE), [
                  cond(
                    eq(this.manualTriggerValue, -1),
                    set(this.pointerY, absoluteY),
                  ),
                  call(
                    [
                      this.pointerY,
                      this.scrollTopValue,
                      this.containerOffsetTopValue,
                      this.manualTriggerValue,
                      this.isSavingValue,
                    ],
                    this.handleLongPressActive,
                  ),
                ]),
                cond(
                  and(
                    neq(this.gestureStateValue, GestureState.ACTIVE),
                    and(
                      eq(oldState, GestureState.ACTIVE),
                      or(
                        eq(state, GestureState.END),
                        eq(state, GestureState.FAILED),
                      ),
                    ),
                  ),
                  call([], this.handleLongPressCancelled),
                ),
              ]),
            ],
          ),
        ]),
    },
  ]);
  // }}}

  //// scrollMethods {{{
  public setScrollLowerBound = (contentWidth, contentHeight) => {
    const scrollDiff =
      contentHeight - this.state.containerHeight + this.state.largestItemHeight;

    // TODO this value doesn't seem to be the correct scrollEnd
    // @ts-ignore Animated setValue
    this.scrollTopLowerBoundValue.setValue(scrollDiff);
  }

  public autoScrollComplete = (params: number[]) => {
    if (this.autoScrollResolve) {
      this.autoScrollResolve(params);
      this.autoScrollResolve = null;
    }
  }

  public callAutoScrollComplete = call(
    [
      this.scrollTopValue,
      this.scrollTopLowerBoundValue,
      this.isAutoScrollDownValue,
      this.isAutoScrollUpValue,
      this.touchOutOfBoundsValue,
    ],
    this.autoScrollComplete,
  );

  public onScroll = event([
    {
      nativeEvent: ({ contentOffset }) =>
        block([
          set(this.scrollTopValue, contentOffset.y),
          cond(
            and(
              eq(this.isAutoScrollDownValue, 1),
              greaterOrEq(
                round(this.scrollTopValue),
                round(this.autoScrollTargetValue),
              ),
            ),
            [
              set(this.hasScrollTopMatchedTargetValue, 1),
              this.callAutoScrollComplete,
            ],
          ),
          cond(
            and(
              eq(this.isAutoScrollUpValue, 1),
              lessOrEq(
                round(this.scrollTopValue),
                round(this.autoScrollTargetValue),
              ),
            ),
            [
              set(this.hasScrollTopMatchedTargetValue, 1),
              this.callAutoScrollComplete,
            ],
          ),
          // unset hasScrollTopMatchedTargetValue
          cond(
            and(
              and(
                eq(this.isAutoScrollDownValue, 1),
                eq(this.hasScrollTopMatchedTargetValue, 1),
              ),
              lessThan(this.scrollTopValue, this.autoScrollTargetValue),
            ),
            set(this.hasScrollTopMatchedTargetValue, 0),
          ),
          cond(
            and(
              and(
                eq(this.isAutoScrollUpValue, 1),
                eq(this.hasScrollTopMatchedTargetValue, 1),
              ),
              greaterThan(this.scrollTopValue, this.autoScrollTargetValue),
            ),
            set(this.hasScrollTopMatchedTargetValue, 0),
          ),
        ]),
    },
  ]);
  // }}}

  // scrollToAsync {{{
  public scrollToAsync = (scrollTarget) =>
    new Promise((resolve, reject) => {
      this.autoScrollResolve = resolve;
      this.autoScrollTargetValue.setValue(scrollTarget);
      // @ts-ignore apparently _component does not exist in any
      this.flatListRef.current._component.scrollToOffset({
        offset: scrollTarget,
      });
    })

  public autoScroll = async (params: number[]) => {
    const [
      scrollTop,
      scrollTopEnd,
      isAutoScrollDownValue,
      isAutoScrollUpValue,
      isTouchOutOfBounds,
    ] = params;

    if (
      (isAutoScrollDownValue && scrollTop === scrollTopEnd) ||
      (isAutoScrollUpValue && scrollTop === 0)
    ) {
      return;
    }

    const scrollTarget = Math.round(
      isAutoScrollDownValue
        ? Math.min(scrollTop + this.state.scrollSpeed, scrollTopEnd)
        : Math.max(0, scrollTop - this.state.scrollSpeed),
    );

    const nextScrollParams = await this.scrollToAsync(scrollTarget);
    if (!this.scrollEnabled && !isTouchOutOfBounds) {
      // @ts-ignore TODO fix lint error
      this.autoScroll(nextScrollParams);
    }
  }
  // }}}

  // trackHover {{{
  public trackHover = (params: number[]) => {
    const [yPos, scrollTop, containerOffsetTop, activeItemArray] = params;

    // trackActiveHover
    const currentActiveHoverIndex = this.calculateActiveItem(
      yPos,
      scrollTop,
      containerOffsetTop,
    );

    if (
      currentActiveHoverIndex !== this.activeHoverIndex &&
      currentActiveHoverIndex !== -1
    ) {
      this.activeHoverIndex = currentActiveHoverIndex;
      this.activeHoverIndexValue.setValue(currentActiveHoverIndex);

      // const { dataWithId } = this.state;
      // const { arrayIndex } = dataWithId[currentActiveHoverIndex];
      const { arrayIndex } = this.dataWithProps[currentActiveHoverIndex];
      // @ts-ignore AnimatedValue number
      this.activeHoverArrayIndexValue.setValue(arrayIndex);
      this.activeHoverArrayIndex = arrayIndex;
    }

    // track hoverZone
    const touchY = yPos - containerOffsetTop + scrollTop;
    const activeZone = this.activeHoverZones.reduce((final, bounds, index) => {
      const { top, bottom } = bounds;
      if (touchY > top && touchY < bottom) {
        return index;
      }

      return final;
    }, -1);

    if (activeZone === activeItemArray) {
      // @ts-ignore Animated setValue
      this.activeHoverZoneValue.setValue(activeZone);
      this.activeHoverOutOfBoundsValue.setValue(0);
      return;
    }

    if (
      this.activeHoverZones[activeItemArray] &&
      touchY < this.activeHoverZones[activeItemArray].top
    ) {
      // @ts-ignore Animated setValue
      this.activeHoverZoneValue.setValue(activeItemArray - 1);
    } else {
      // @ts-ignore Animated setValue
      this.activeHoverZoneValue.setValue(activeItemArray + 1);
    }

    // @ts-ignore Animated setValue
    this.activeHoverOutOfBoundsValue.setValue(1);
  }
  // }}}

  // {{{ Align itemTranslateY
  public updateAllItemY = (updatedDataList) => {
    this.state.dataWithId.forEach(
      ({
        draggableId: initialDraggableId,
        draggableIdValue,
        itemKey: itemKeyState,
      }) => {
        const {
          draggableId,
          arrayIndex,
          itemTranslateY,
        } = updatedDataList.find(({ itemKey }) => itemKey === itemKeyState);
        draggableIdValue.setValue(draggableId);
        // set the updated item position
        const itemHeight = this.state.itemHeights[arrayIndex];
        const diff = draggableId - initialDraggableId;
        const newY = diff * itemHeight;

        itemTranslateY.setValue(newY);
      },
    );
  }
  // }}}

  // onGesture {{{
  public callAutoScroll = call(
    [
      this.scrollTopValue,
      this.scrollTopLowerBoundValue,
      this.isAutoScrollDownValue,
      this.isAutoScrollUpValue,
      this.touchOutOfBoundsValue,
    ],
    this.autoScroll,
  );

  public handleSave = (params: number[]) => {
    const [activeItem] = params;

    if (activeItem === -1) {
      // @ts-ignore
      this.flatListRef.current.setNativeProps({ scrollEnabled: true });
      this.resetClassVariables();
      return;
    }

    const updatedDataList = this.getReorderedData();
    this.updateAllItemY(updatedDataList);
    // @ts-ignore
    this.flatListRef.current.setNativeProps({ scrollEnabled: true });
    this.dataWithProps = updatedDataList;
    this.resetClassVariables();

    const { disableAutoUpdate, updateListOnDragEnd } = this.props;
    if (!disableAutoUpdate && updateListOnDragEnd) {
      this.updateListOnDragEnd();
    }
  }

  public onGestureEvent = event([
    {
      nativeEvent: ({ state, oldState, absoluteY }) =>
        block([
          cond(eq(this.isSavingValue, 0), [
            set(this.gestureStateValue, state),
            set(this.gestureOldStateValue, oldState),
            onChange(this.gestureStateValue, [
              cond(
                or(eq(state, GestureState.FAILED), eq(state, GestureState.END)),
                [
                  set(this.isSavingValue, 1),
                  call([this.activeItemIndexValue], this.handleSave),
                ],
              ),
            ]),
            cond(
              and(
                and(
                  and(
                    eq(this.initialSetUpFinishedValue, 1),
                    eq(this.isSavingValue, 0),
                  ),
                  eq(state, GestureState.ACTIVE),
                ),
                or(
                  neq(this.manualTriggerValue, -1),
                  eq(this.longPressStateValue, GestureState.ACTIVE),
                ),
              ),
              [
                // {{{ Track if touchY is out of bounds
                cond(
                  or(
                    lessThan(absoluteY, this.containerOffsetTopValue),
                    greaterThan(
                      absoluteY,
                      add(
                        this.containerOffsetTopValue,
                        this.containerHeightValue,
                      ),
                    ),
                  ),
                  [
                    cond(lessThan(absoluteY, this.containerOffsetTopValue), [
                      set(this.touchOutOfBoundsValue, 1),
                      set(this.touchOutOfBoundsTopValue, 1),
                    ]),
                    cond(
                      greaterThan(
                        absoluteY,
                        add(
                          this.containerOffsetTopValue,
                          this.containerHeightValue,
                        ),
                      ),
                      [
                        set(this.touchOutOfBoundsValue, 1),
                        set(this.touchOutOfBoundsBottomValue, 1),
                      ],
                    ),
                  ],
                  [
                    set(this.touchOutOfBoundsValue, 0),
                    set(this.touchOutOfBoundsTopValue, 0),
                    set(this.touchOutOfBoundsBottomValue, 0),
                  ],
                ),
                // }}}
                cond(eq(this.touchOutOfBoundsValue, 0), [
                  // Track translateYValue for active block translationY
                  set(this.pointerY, absoluteY),
                  // Track currently hovered item
                  call(
                    [
                      this.pointerY,
                      this.scrollTopValue,
                      this.containerOffsetTopValue,
                      this.activeItemArrayIndexValue,
                    ],
                    this.trackHover,
                  ),
                  // With lowerBound Active Zone
                  // {{{
                  cond(
                    and(
                      eq(this.hasAutoScrollStartedValue, 0),
                      and(
                        greaterThan(absoluteY, this.containerLowerBoundValue),
                        lessThan(
                          this.scrollTopValue,
                          this.scrollTopLowerBoundValue,
                        ),
                      ),
                    ),
                    [
                      set(this.hasAutoScrollStartedValue, 1),
                      set(this.isAutoScrollDownValue, 1),
                      this.callAutoScroll,
                    ],
                  ),
                  // }}}
                  // upperBound active zone
                  // {{{
                  cond(
                    and(
                      eq(this.hasAutoScrollStartedValue, 0),
                      and(
                        lessThan(absoluteY, this.containerUpperBoundValue),
                        greaterThan(this.scrollTopValue, 0),
                      ),
                    ),
                    [
                      set(this.hasAutoScrollStartedValue, 1),
                      set(this.isAutoScrollUpValue, 1),
                      this.callAutoScroll,
                    ],
                  ),
                  // }}}
                  // Out of lowerbound zone - reset hasAutoScrollStartedValue
                  // {{{
                  cond(
                    and(
                      eq(this.isAutoScrollDownValue, 1),
                      lessThan(absoluteY, this.containerLowerBoundValue),
                    ),
                    [
                      set(this.hasAutoScrollStartedValue, 0),
                      set(this.isAutoScrollDownValue, 0),
                    ],
                  ),
                  // out of upperbound
                  cond(
                    and(
                      eq(this.isAutoScrollUpValue, 1),
                      greaterThan(absoluteY, this.containerUpperBoundValue),
                    ),
                    [
                      set(this.hasAutoScrollStartedValue, 0),
                      set(this.isAutoScrollUpValue, 0),
                    ],
                  ),
                  // }}}
                ]),
              ],
            ),
          ]),
        ]),
    },
  ]);
  // }}}

  // run timing {{{
  public runTiming = (
    clock,
    startingPosition,
    dest,
    idValue,
    arrayIndex,
    activeItemFinalTarget,
  ) => {
    const {
      activeItemIndexValue,
      activeItemArrayIndexValue,
      isSavingValue,
    } = this;

    const state = {
      finished: new Value(0),
      position: new Value(0),
      time: new Value(0),
      frameTime: new Value(0),
    };

    const config = {
      duration: 300,
      toValue: new Value(0),
      easing: Easing.inOut(Easing.ease),
    };

    return block([
      cond(
        eq(activeItemIndexValue, -1),
        [dest],
        cond(
          eq(idValue, activeItemIndexValue),
          // startingPosition is passed in and mutated - slightly hacky, but no better solution at present
          [
            cond(
              eq(isSavingValue, 1),
              [
                set(startingPosition, activeItemFinalTarget),
                activeItemFinalTarget,
              ],
              dest,
            ),
          ],
          [
            cond(neq(arrayIndex, activeItemArrayIndexValue), startingPosition, [
              cond(
                clockRunning(clock),
                [set(config.toValue, dest)],
                cond(neq(state.position, dest), [
                  set(state.finished, 0),
                  set(state.time, 0),
                  set(state.position, startingPosition),
                  set(state.frameTime, 0),
                  set(config.toValue, dest),
                  startClock(clock),
                ]),
              ),
              timing(clock, state, config),
              cond(state.finished, [stopClock(clock)]),
              cond(eq(isSavingValue, 1), set(startingPosition, dest)),
              state.position,
            ]),
          ],
        ),
      ),
    ]);
  }
  // }}}

  // {{{ getItemTranslateY
  public getItemTranslateY = (
    draggableId: number,
    arrayIndex: number,
    itemTranslateY: Animated.Value<number>,
  ) => {
    const {
      activeItemIndexValue,
      activeItemArrayIndexValue,
      activeHoverIndexValue,
      itemHeightValues,
      hiddenContentHeightValue,
      firstItemIds,
      lastItemIds,
      itemArrayIds,
      itemOffsets,
      pointerY,
      scrollTopValue,
      touchOutOfBoundsValue,
      touchOutOfBoundsTopValue,
      activeHoverOutOfBoundsValue,
      activeHoverZoneValue,
      containerOffsetTopValue,
    } = this;

    const clock = new Clock();

    const itemHeight = interpolate(activeItemArrayIndexValue, {
      inputRange: itemArrayIds,
      outputRange: itemHeightValues,
    });
    const itemOffset = itemOffsets[arrayIndex];
    const firstItemId = interpolate(activeItemArrayIndexValue, {
      inputRange: itemArrayIds,
      outputRange: firstItemIds,
    });

    const activeItemRelativeY = multiply(
      itemHeight,
      sub(draggableId, firstItemId),
    );
    const activeItemOffset = add(itemOffset, activeItemRelativeY);

    const hoverBelowOffset = add(multiply(itemHeight, -1), itemTranslateY);
    const hoverAboveOffset = add(itemHeight, itemTranslateY);

    const outOfBoundTopPosition = multiply(
      sub(firstItemId, draggableId),
      itemHeight,
    );
    const lastItemId = interpolate(this.activeItemArrayIndexValue, {
      inputRange: itemArrayIds,
      outputRange: lastItemIds,
    });
    const outOfBoundBottomPosition = multiply(
      sub(lastItemId, draggableId),
      itemHeight,
    );

    const targetTranslateY = cond(
      eq(activeItemIndexValue, -1),
      // No active item resume cached position
      itemTranslateY,
      [
        cond(
          eq(draggableId, activeItemIndexValue),
          // active Item
          add(
            cond(
              or(
                eq(touchOutOfBoundsValue, 1),
                eq(activeHoverOutOfBoundsValue, 1),
              ),
              cond(
                or(
                  eq(touchOutOfBoundsTopValue, 1),
                  lessThan(activeHoverZoneValue, activeItemArrayIndexValue),
                ),
                outOfBoundTopPosition,
                outOfBoundBottomPosition,
              ),
              add(
                sub(
                  sub(
                    sub(pointerY, divide(itemHeight, 2)),
                    containerOffsetTopValue,
                  ),
                  activeItemOffset,
                ),
                multiply(
                  divide(scrollTopValue, hiddenContentHeightValue),
                  hiddenContentHeightValue,
                ),
              ),
            ),
            itemTranslateY,
          ),
          // all other items
          cond(
            eq(activeHoverIndexValue, -1),
            itemTranslateY,
            cond(
              // all cells hovered below active need to move up one
              and(
                greaterThan(draggableId, activeItemIndexValue),
                lessOrEq(draggableId, activeHoverIndexValue),
              ),
              hoverBelowOffset,
              cond(
                // all cells hovered above the active need to move down one
                and(
                  lessThan(draggableId, activeItemIndexValue),
                  greaterOrEq(draggableId, activeHoverIndexValue),
                ),
                hoverAboveOffset,
                // all cells unaffected should resume the current translateY
                itemTranslateY,
              ),
            ),
          ),
        ),
      ],
    );

    const clampedActiveHoverIndex = cond(
      lessThan(activeHoverIndexValue, firstItemId),
      firstItemId,
      cond(
        greaterThan(activeHoverIndexValue, lastItemId),
        lastItemId,
        activeHoverIndexValue,
      ),
    );
    const activeItemFinalTarget = cond(
      eq(activeHoverIndexValue, -1),
      itemTranslateY,
      add(
        itemTranslateY,
        multiply(itemHeight, sub(clampedActiveHoverIndex, activeItemIndexValue)),
      ),
    );

    const translateY = this.runTiming(
      clock,
      itemTranslateY,
      targetTranslateY,
      draggableId,
      arrayIndex,
      activeItemFinalTarget,
    );
    return translateY;
  }
  // }}}

  // draggableRenderItem {{{
  public draggableRenderItem = (renderProps) => {
    const {
      item: { draggableId, arrayIndex, itemTranslateY, draggableIdValue },
    } = renderProps;

    const {
      activeItemIndexValue,
      activeHoverArrayIndexValue,
      firstItemRefs,
      firstItemIds,
      touchOutOfBoundsValue,
      activeHoverOutOfBoundsValue,
      headerRefs,
    } = this;

    const { isDataMultipleLists } = this.state;

    const hasMultipleRenderItems = Array.isArray(this.props.renderItem);
    const renderItem = hasMultipleRenderItems
      ? this.props.renderItem[arrayIndex]
      : this.props.renderItem;

    const renderHeader = Array.isArray(this.props.renderHeader)
      ? this.props.renderHeader[arrayIndex]
      : this.props.renderHeader;

    if (typeof renderItem !== 'function') {
      console.error(
        'Missing "renderItem" prop: Either [1] mismatch of renderItem and data or [2] renderItem props is missing. [1] data is of object[][] and renderItem is not of fn[][]. [2] missing prop renderItem ',
      );
    }
    // setting up the refs for measuring the height of the cells
    const isListFirstItem =
      draggableId === 0 ||
      (isDataMultipleLists && firstItemIds.indexOf(draggableId) > -1);
    const itemRef = isListFirstItem ? firstItemRefs[arrayIndex] : null;
    const headerRef =
      isListFirstItem && headerRefs ? headerRefs[arrayIndex] : null;

    const opacity = cond(
      neq(draggableIdValue, activeItemIndexValue),
      1,
      cond(
        or(
          and(
            neq(activeHoverArrayIndexValue, -1),
            neq(activeHoverArrayIndexValue, arrayIndex),
          ),
          or(eq(activeHoverOutOfBoundsValue, 1), eq(touchOutOfBoundsValue, 1)),
        ),
        0.5,
        1,
      ),
    );

    const translateY = this.getItemTranslateY(
      draggableIdValue,
      arrayIndex,
      itemTranslateY,
    );
    const style = {
      transform: [{ translateY }],
      opacity,
    };

    const onPressIn = () => this.manualStartDrag(draggableId);

    const renderPropsWithFns = {
      ...renderProps,
      onPressIn,
    };

    return (
      <React.Fragment>
        {isListFirstItem && renderHeader ? (
          <Animated.View ref={headerRef}>{renderHeader()}</Animated.View>
        ) : null}
        <Animated.View
          ref={itemRef}
          // @ts-ignore
          style={style}
        >
          {renderItem(renderPropsWithFns)}
        </Animated.View>
      </React.Fragment>
    );
  }
  // }}}

  // Render {{{
  public render() {
    const { keyExtractor } = this.props;
    const { dataWithId } = this.state;

    if (!dataWithId.length) {
      return null;
    }

    return (
      <TapGestureHandler
        ref={this.tapRef}
        onHandlerStateChange={this.onTapStateChange}
        simultaneousHandlers={[this.longPressRef, this.panGestureRef]}
        maxDist={10000}
      >
        <Animated.View style={[styles.flexContainerOverflow]}>
          <LongPressGestureHandler
            ref={this.longPressRef}
            minDurationMs={300}
            onHandlerStateChange={this.onLongPress}
            simultaneousHandlers={[this.panGestureRef, this.tapRef]}
            // on android if the movement exceeds the maxDist the longPress will cancel
            maxDist={10000}
          >
            <Animated.View style={[styles.flexContainer]}>
              <PanGestureHandler
                ref={this.panGestureRef}
                onGestureEvent={this.onGestureEvent}
                onHandlerStateChange={this.onGestureEvent}
                simultaneousHandlers={[this.tapRef, this.longPressRef]}
              >
                <Animated.View style={[styles.flexContainer]}>
                  <AnimatedFlatList
                    ref={this.flatListRef}
                    onScroll={this.onScroll}
                    onLayout={this.handleFlatListLayout}
                    data={dataWithId}
                    renderItem={this.draggableRenderItem}
                    keyExtractor={keyExtractor}
                    onContentSizeChange={this.setScrollLowerBound}
                    // This seems to be defaulted as true on android!!
                    removeClippedSubviews={false}
                    scrollEventThrottle={16}
                  />
                </Animated.View>
              </PanGestureHandler>
            </Animated.View>
          </LongPressGestureHandler>
        </Animated.View>
      </TapGestureHandler>
    );
    // }}}
  }
}
