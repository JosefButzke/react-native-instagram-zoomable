// @flow

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ReactNative, { Animated, Easing, PanResponder, StyleSheet, View, ViewPropTypes, Dimensions } from 'react-native';

import getDistance from './helpers/getDistance';
import getScale from './helpers/getScale';

import type { Touch } from './types/Touch-type';


const RESTORE_ANIMATION_DURATION = 200;


type Event = {
    nativeEvent: {
        touches: Array<Touch>;
    };
};

type GestureState = {
    stateID: string;
    dx: number;
    dy: number;
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});


export class ElementContainer extends PureComponent {
    static propTypes = {
        children: PropTypes.oneOfType([
            PropTypes.element,
            PropTypes.arrayOf(PropTypes.element),
        ]).isRequired,

        style: ViewPropTypes.style,
    };

    static defaultProps = {
        style: null,
    };

    static contextTypes = {
        isDragging: PropTypes.bool,
        onGestureStart: PropTypes.func,
        onGestureRelease: PropTypes.func,

        gesturePosition: PropTypes.object,
        scaleValue: PropTypes.object,
    };

    _parent: ?Object;
    _gestureHandler: Object;
    _gestureInProgress: ?string;
    _selectedMeasurement: Measurement;
    _initialTouches: Array<Object>;

    _opacity: Animated.Value;

    constructor() {
        super(...arguments);

        this._startGesture = this._startGesture.bind(this);
        this._measureSelected = this._measureSelected.bind(this);

        this._initialTouches = [];
        this._opacity = new Animated.Value(1);

        this._generatePanHandlers();
    }

    render() {
        const { children, style } = this.props;

        return (
            <Animated.View
                collapsable={false}
                detail={true}
                style={[styles.container, style, {
                    opacity: this._opacity
                }]}
                ref={node => (this._parent = node)}
                {...this._gestureHandler.panHandlers}
            >
                { children }
            </Animated.View>
        );
    }

    _generatePanHandlers = () => {
        this._gestureHandler = PanResponder.create({
            onStartShouldSetResponderCapture: () => true,
            onStartShouldSetPanResponderCapture: (event: Event) => {
                // if context to IstagramProvider exists AND two fingers are used for gesture
                return typeof this.context.isDragging !== 'undefined' && event.nativeEvent.touches.length === 2;
            },
            onMoveShouldSetResponderCapture: () => true,
            onMoveShouldSetPanResponderCapture: (event: Event) => {
                // if context to IstagramProvider exists AND two fingers are used for gesture
                return typeof this.context.isDragging !== 'undefined' && event.nativeEvent.touches.length === 2;
            },
            onPanResponderGrant: this._startGesture,
            onPanResponderMove: this._onGestureMove,
            onPanResponderRelease: this._onGestureRelease,
            onPanResponderTerminationRequest: () => {
                return this._gestureInProgress == null;
            },
            onPanResponderTerminate: (event, gestureState) => {
                return this._onGestureRelease(event, gestureState);
            },
        });
    };

    async _startGesture(event: Event, gestureState: GestureState) {
        // Sometimes gesture start happens two or more times rapidly.
        if (this._gestureInProgress) {
            return;
        }

        this._gestureInProgress = gestureState.stateID;
        let { gesturePosition, onGestureStart } = this.context;
        let { touches } = event.nativeEvent;
        this._initialTouches = touches;

        this._selectedMeasurement = await this._measureSelected();

        onGestureStart({
            element: this,
            measurement:  this._selectedMeasurement,
        });

        gesturePosition.setValue({
            x: 0,
            y: 0,
        });

        gesturePosition.setOffset({
            x: 0,
            y: ( this._selectedMeasurement &&  this._selectedMeasurement.y) || 0,
        });

        Animated.timing(this._opacity, {
            toValue: 0,
            duration: RESTORE_ANIMATION_DURATION,
            easing: Easing.ease,
            useNativeDriver: true,
        }).start();

    };

    _onGestureMove = (event: Event, gestureState: GestureState) => {
        let { touches } = event.nativeEvent;

        if (!this._gestureInProgress) {
            return;
        }
        if (touches.length < 2) {
            // Trigger a realease
            this._onGestureRelease(event, gestureState);
            return;
        }

        // for moving photo around
        let { gesturePosition, scaleValue } = this.context;
        let { dx, dy } = gestureState;
        let posX = dx;
        let posY = dy;

        const locationX = new Animated.Value(this._initialTouches[0].locationX);
        const locationY = new Animated.Value(this._initialTouches[0].locationY);

        const width = Dimensions.get('screen').width;
        const height = Dimensions.get('screen').height;

        let paddingX = new Animated.Value(1);
        let paddingY = new Animated.Value(1);

        // ajuste eixo X
        if(scaleValue._value > 1.05){
            paddingX = locationX.interpolate({
                inputRange: [0, width],
                outputRange: [- width/2 + 130, width/2 - 130]
            });

            paddingY = locationY.interpolate({
                inputRange: [0, height],
                outputRange: [80, -230]
            });
        }


        gesturePosition.x.setValue(dx + (-1 * parseFloat(JSON.stringify(paddingX)) * (scaleValue._value * scaleValue._value * 0.7)));

        gesturePosition.y.setValue(dy + parseFloat(JSON.stringify(paddingY)) * scaleValue._value);

        // for scaling photo
        let currentDistance = getDistance(touches);
        let initialDistance = getDistance(this._initialTouches);
        let newScale = getScale(currentDistance, initialDistance);
        
        scaleValue.setValue(newScale < 1.0 ? 1.0 : newScale > 2.5 ? 2.5 : newScale);
    };

    _onGestureRelease = (event, gestureState: GestureState) => {
        if (this._gestureInProgress !== gestureState.stateID) {
            return;
        }

        this._gestureInProgress = null;
        this._initialTouches = [];

        let { gesturePosition, scaleValue, onGestureRelease } = this.context;
        // set to initial position and scale
        Animated.parallel([
            Animated.timing(gesturePosition.x, {
                toValue: 0,
                duration: RESTORE_ANIMATION_DURATION,
                easing: Easing.ease,
                useNativeDriver: true,
            }),
            Animated.timing(gesturePosition.y, {
                toValue: 0,
                duration: RESTORE_ANIMATION_DURATION,
                easing: Easing.ease,
                useNativeDriver: true,
            }),
            Animated.timing(scaleValue, {
                toValue: 1,
                duration: RESTORE_ANIMATION_DURATION,
                easing: Easing.ease,
                useNativeDriver: true,
            }),
        ]).start(() => {
            gesturePosition.setOffset({
                x: 0,
                y: (this._selectedMeasurement && this._selectedMeasurement.y) || 0,
            });

            this._opacity.setValue(1);

            requestAnimationFrame(() => {
                onGestureRelease();
            });
        });

        scaleValue.setValue(1.0);
    };

    async _measureSelected() {
        return new Promise((resolve, reject) => {
            try {
                this._parent._component.measure( (fx, fy, width, height, px, py) => {
                    resolve({
                        x: px,
                        y: py,
                        w: width,
                        h: height,
                    });
                })
            } catch (e) {
                reject(e);
            }
        });
    }
}


export default ElementContainer;
