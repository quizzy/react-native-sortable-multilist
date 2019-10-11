# React-Native-Sortable-Multilist

A react-native component for rendering and sorting multiple lists. The component uses [`react-native-gesture-handler`](https://github.com/kmagiera/react-native-gesture-handler) and [`react-native-reanimated`](https://github.com/kmagiera/react-native-reanimated)
for a performant result. Items can be reordered by long pressing on the item and then dragging around and dropping in order to reorder a list or lists.

![react-native-sortable-multilist](https://github.com/quizzy/react-native-sortable-multilist/blob/master/screenshots/react-native-sortable-multilist.gif)

## Getting Started

### Prerequisites

The component is built up around components from [`react-native-gesture-handler`](https://github.com/kmagiera/react-native-gesture-handler) and [`react-native-reanimated`](https://github.com/kmagiera/react-native-reanimated)
and therefore will have to be installed in your project in order to use `react-native-sortable-multilist`.

They were declared as peer dependencies, because `react-native link`ing is involved in order to get both libraries running properly in your project. In particular `react-native-gesture-handler` can require some additional set up if your project uses `react-native-navigation` or `react-navigation`.


```
yarn add `react-native-gesture-handler`
yarn add `react-native-reanimated`
```

#### Linking

The readme pages for both packages will tell you that you can run `react-native link` in order to link the underlying native libraries to your project, but I found this didn't work properly, instead I think manually linking for both `iOS` and `android` work best.

##### iOS manual linking
For instructions on how to manually link both libraries on iOS follow the instructions given this [thread](https://github.com/kmagiera/react-native-gesture-handler/issues/494#issuecomment-469456140)

##### android manual linking
For instructions on how to manually link both libraries on android follow the instructions given in this [thread](https://github.com/kmagiera/react-native-gesture-handler/issues/684#issuecomment-510828962)

### Installing

Once you have installed and linked both of the above libraries, you can install this package using `yarn` or `npm`.

```
yarn add react-native-sortable-multilist
```

Or

```
npm install react-native-sortable-multilist
```

## Usage / API

```
import { SortableMultilist } from 'react-native-sortable-multilist';
```

| prop | type | description |
| --- | --- | --- |
| `data` | `[{ dataItem }] \| [[{ dataItem }]]` | `required`<br> A flat array or an array of arrays containing the list(s) of data that you want to enable sorting on. |
| `renderItem` | `({ item }) => React.Component \| [({ item }) => React.Component]` | `required`<br> A render function or an array of render functions.<br><br> If you have 2 lists of data, then you can provide 2 render functions in an array so that the 2 lists can be rendered as different components. (You can optionally just used one renderItem function with multiple arrays of data)<br><br> i.e. if `data={[list1, list2]}`, then `renderItem` can be `renderItem={[renderFn1, renderFn2]}`. `{ item }` is an entry from the data list provided in the data prop, the shape of it is up to you. |
| `keyExtractor` | `(item, index) => string` | `required`<br> A keyExtractor function that receives the entry from the data list and the index, this function needs to return a unique string to be used as the `key` for the render function. |
| `renderHeader` | `() => React.Component \| [() => React.Component]` | `not required`<br> Render function or an array of them for rendering a `Header` component between each list.<br> The length of the array needs to match the length of the `data` if multiple lists are being used. | 
| `updateListOnDragEnd`| `(list: Data) => void` | `not required`<br> A function that will receive the updated list(s) when the dragging/sorting ends |
| `updateListDebounceDuration` | `number` | `not required` `default value === 3000`<br> Duration in milliseconds for debouncing calls to `updateListOnDragEnd`.<br> Debounce is used in order to make the component more performant, as calls to `setState` generate re-renders which cause a considerable amount of lag to the interactions of the component. |
| `disableUpdateListDebounce` | `boolean` | `not required` `default value === false`<br> Debouncing can be turned off so that `updateListOnDragEnd` is called immediately after every interaction rather then waiting for the `updateListDebounceDuration`, as mentioned above this can cause performance issues. |
| `disableAutoUpdate` | `boolean` | `not required` `default value === false`<br> Enabling `disableAutoUpdate` makes the list super performant as no `setState`s will occur whilst a user is interacting with the list.<br><br> This is only useful if a `ref` is added to the `SortableMultilist` so that the parent can call `getListForSaving()` directly from the ref. i.e. `sortableMultilistRef.current.getListForSaving()` will return the sorted list so that a `setState` can be performed manually from the parent component.<br> See [Most Performant Usage](#most-performant-usage) for an example. |

### Examples

#### Multiple Lists
```JSX
import * as React from 'react';
import { View, Text } from 'react-native';
import { SortableMultilist } from 'react-native-sortable-multilist';

const Header1 = () => (<View><Text>Header 1</Text></View>);
const Header2 = () => (<View><Text>Header 2</Text></View>);
const RenderItem1 = ({ item }) => (<View><Text>{item.text}</Text></View>);
const RenderItem2 = ({ item }) => (<View><Text>{item.text}</Text></View>);

const list1 = [...Array(10)].map((item, index) => ({
  text: `Foo-${index}`
}));

const list2 = [...Array(10)].map((item, index) => ({
  text: `Bar-${index}`
}));

const keyExtractor = (item: Item, index: number) => `${item.text}-${index}`;
const renderItem = [RenderItem1, RenderItem2];
const renderHeader = [Header1, Header2];

export function MultiListExample() {
  const [list1State, updateList1] = React.useState(list1);
  const [list2State, updateList1] = React.useState(list2);

  const data = [list1State, list2State];

  const updateListOnDragEnd = (list) => {
    const [updatedList1, updatedList2] = list;
    updateList1(updatedList1);
    updateList2(updatedList2);
};

  return (
    <SortableMultilist
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      renderHeader={renderHeader}
      updateListOnDragEnd={updateListOnDragEnd}
      />
  );
} 
```

#### Single List
```JSX
// ... (see above for imports etc..)
const keyExtractor = (item: Item, index: number) => `${item.text}-${index}`;
const renderItem = RenderItem1;
const renderHeader = Header1;

export function MultiListExample() {
  const [list1State, updateList1] = React.useState(list1);

  const updateListOnDragEnd = (list) => {
    updateList1(list);
  };

  return (
    <SortableMultilist
      data={list1State}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      renderHeader={renderHeader}
      updateListOnDragEnd={updateListOnDragEnd}      
    />
  );
} 
```

#### Most Performant Usage
```JSX
// ... (see above for imports etc..)
const keyExtractor = (item: Item, index: number) => `${item.text}-${index}`;
const renderItem = RenderItem1;
const renderHeader = Header1;

export function MultiListExample() {
  const sortableListRef = React.createRef();
  const [list1State, updateList1] = React.useState(list1);
  const updateListOnDragEnd = (list) => {
    updateList1(list);
  };
	
  const manuallyUpdateListState = () => {
    const updatedList = sortableListRef.current.getListForSaving();
    updateListOnDragEnd(updatedList);
  }
  
  return (
    <>
      <SortableMultilist
        ref={sortableListRef}
	data={list1State}
	keyExtractor={keyExtractor}
	renderItem={renderItem}
	renderHeader={renderHeader}
	disableAutoUpdate
      />
      <TouchableOpacity onPress={manuallyUpdateListState}>
	<Text>Update List Now</Text>
      </TouchableOpacity>
    </>
  );
}  
```

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/quizzy/react-native-sortable-multilist/tags). 

## Authors

* **Quang Vong** - [quizzy](https://github.com/quizzy)

See also the list of [contributors](https://github.com/your/project/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

* `react-native-gesture-handler`
* `react-native-reanimated`
* `react-native-draggable-flatlist`
