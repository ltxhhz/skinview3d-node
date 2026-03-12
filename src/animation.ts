import { PlayerObject } from 'model.js';

type Params = Record<
	string,
	{
		value: number | string | boolean;
		desc: string;
		choices?: string[];
	}
> & {
	multiple: {
		value: number;
		desc: string;
	};
	delay: {
		value: number;
		desc: string;
	};
};

const defaultParams = {
	multiple: {
		value: 1,
		desc: '整数倍频率'
	},
	delay: {
		value: 5,
		desc: '每帧延迟时间 1/100ms, 1=10ms'
	}
};

type ExtractValueType<T> = T extends { value: infer V } ? V : never;

// 映射类型，保留每个键对应的值的具体类型
type ParamsValues<T extends Params> = {
  [K in keyof T]: ExtractValueType<T[K]>;
};

function getParamsValue<T extends Params>(params:T): ParamsValues<T> {
	return Object.fromEntries(
		Object.entries(params).map(([key, value]) => [
			key,
			value.value
		])
	) as ParamsValues<T>;
}

export abstract class PlayerAnimation {
	static params = {
		...defaultParams
	};

	// params: Record<string, number | string | boolean> = getParamsValue(PlayerAnimation.params);
	/**
	 * 渲染某一帧的姿态
	 * @param player 播放器对象
	 * @param progress 动画进度，范围 [0, 1]。0代表起点，1代表终点（或循环回起点）
	 */
	protected abstract animate(player: PlayerObject, progress: number): void;

	// 这一层只需要暴露一个接口给外部调用
	public render(player: PlayerObject, progress: number): void {
		// 确保 progress 在 0-1 之间 (可选，视需求而定)
		// const p = progress % 1.0;
		this.animate(player, progress);
	}
}

/**
 * A class that helps you create an animation from a function.
 *
 * @example
 * To create an animation that rotates the player:
 * ```
 * new FunctionAnimation((player, progress) => player.rotation.y = progress)
 * ```
 */
export class FunctionAnimation extends PlayerAnimation {
	static title = '函数'
	static params = {
		...defaultParams
	};

	params = getParamsValue(PlayerAnimation.params);

	fn: (player: PlayerObject, progress: number) => void;

	constructor(fn: (player: PlayerObject, progress: number) => void) {
		super();
		this.fn = fn;
	}

	protected animate(player: PlayerObject, progress: number): void {
		this.fn(player, progress);
	}
}

export class IdleAnimation extends PlayerAnimation {
	static title = '常态'
	static params = {
		...defaultParams
	};

	params = getParamsValue(IdleAnimation.params);
	protected animate(player: PlayerObject, progress: number): void {
		// Multiply by animation's natural speed
		const t = progress * 2 * Math.PI * this.params.multiple;

		// Arm swing
		const basicArmRotationZ = Math.PI * 0.02;
		player.skin.leftArm.rotation.z = Math.cos(t) * 0.03 + basicArmRotationZ;
		player.skin.rightArm.rotation.z = Math.cos(t + Math.PI) * 0.03 - basicArmRotationZ;

		// Always add an angle for cape around the x axis
		const basicCapeRotationX = Math.PI * 0.06;
		player.cape.rotation.x = Math.sin(t) * 0.01 + basicCapeRotationX;
	}
}

export class WalkingAnimation extends PlayerAnimation {
	/**
	 * Whether to shake head when walking.
	 *
	 * @defaultValue `true`
	 */
	// headBobbing: boolean = true;

	static title = '行走'
	static params = {
		...defaultParams,
		headBobbing: {
			value: true,
			desc: '是否摇晃头部'
		}
	};

	params = getParamsValue(WalkingAnimation.params);

	protected animate(player: PlayerObject, progress: number): void {
		// 基础周期：0 -> 2PI
		// 所有的动作都基于这个 base
		const t = progress * 2 * Math.PI * this.params.multiple;

		// 肢体摆动 (频率 1x)
		player.skin.leftLeg.rotation.x = Math.sin(t) * 0.5;
		player.skin.rightLeg.rotation.x = Math.sin(t + Math.PI) * 0.5;
		player.skin.leftArm.rotation.x = Math.sin(t + Math.PI) * 0.5;
		player.skin.rightArm.rotation.x = Math.sin(t) * 0.5;
		const basicArmRotationZ = Math.PI * 0.02;
		player.skin.leftArm.rotation.z = Math.cos(t) * 0.03 + basicArmRotationZ;
		player.skin.rightArm.rotation.z = Math.cos(t + Math.PI) * 0.03 - basicArmRotationZ;

		// 头部摇晃 (频率 2x - 保证在 0-1 周期内摇晃整数次)
		// 原版是 /4, /5，这里为了完美闭环，必须设为整数倍
		// 比如设定：走一圈，头晃 2 次
		if (this.params.headBobbing) {
			// Head shaking with different frequency & amplitude
			player.skin.head.rotation.y = Math.sin(t * 1) * 0.1; // 左右晃
			player.skin.head.rotation.x = Math.sin(t * 2) * 0.05; // 上下晃
		} else {
			player.skin.head.rotation.y = 0;
			player.skin.head.rotation.x = 0;
		}
		// 披风 (频率 1x 或 2x)
		player.cape.rotation.x = Math.sin(t) * 0.06 + Math.PI * 0.06;
	}
}

export class RunningAnimation extends PlayerAnimation {
	static title = '跑步'
	static params = {
		...defaultParams,
		multiply: {
			value: 3,
			desc: defaultParams.multiple.desc
		},

		// jump: {
		// 	value: true,
		// 	desc: '是否跳起'
		// }
	};

	params = getParamsValue(RunningAnimation.params);
	protected animate(player: PlayerObject, progress: number): void {
		// 基础周期：0 -> 2PI
		const t = progress * 2 * Math.PI * this.params.multiple + Math.PI * 0.5; // 保留相位偏移

		// Leg swing with larger amplitude
		player.skin.leftLeg.rotation.x = Math.cos(t + Math.PI) * 1.3;
		player.skin.rightLeg.rotation.x = Math.cos(t) * 1.3;

		// Arm swing
		player.skin.leftArm.rotation.x = Math.cos(t) * 1.5;
		player.skin.rightArm.rotation.x = Math.cos(t + Math.PI) * 1.5;

		// 身体跳动 (频率 2x)
		// 跑一步跳一下，左右各一步，所以跳两下 -> 2x
		player.position.y = Math.cos(t * 2);
		// Dodging when running
		player.position.x = Math.cos(t) * 0.15;
		// Slightly tilting when running
		player.rotation.z = Math.cos(t + Math.PI) * 0.01;

		// Apply higher swing frequency, lower amplitude,
		// and greater basic rotation around x axis,
		// to cape when running.
		// 披风 (频率 2x)
		player.cape.rotation.x = Math.sin(t * 2) * 0.1 + Math.PI * 0.3;
		// What about head shaking?
		// You shouldn't glance right and left when running dude :P
		if (player.nameTag) player.nameTag.position.y = player.position.y + 20;
	}
}
function clamp(num: number, min: number, max: number): number {
	return Math.min(Math.max(num, min), max);
}

export class FlyingAnimation extends PlayerAnimation {
	static title = '飞行'
	static params = {
		...defaultParams,
		multiple: {
			value: 2,
			desc: defaultParams.multiple.desc
		}
	};

	params = getParamsValue(FlyingAnimation.params);
	protected animate(player: PlayerObject, progress: number): void {
		// Body rotation finishes in 0.5s
		// Elytra expansion finishes in 3.3s

		const t = progress * Math.PI * 2 * this.params.multiple;
		const startProgress = clamp((t * t) / 100, 0, 1);

		player.rotation.x = (startProgress * Math.PI) / 2;
		player.skin.head.rotation.x = startProgress > 0.5 ? Math.PI / 4 - player.rotation.x : 0;

		const basicArmRotationZ = Math.PI * 0.25 * startProgress;
		player.skin.leftArm.rotation.z = basicArmRotationZ;
		player.skin.rightArm.rotation.z = -basicArmRotationZ;

		const elytraRotationX = 0.34906584;
		const elytraRotationZ = Math.PI / 2;
		const interpolation = Math.pow(0.9, t);
		player.elytra.leftWing.rotation.x = elytraRotationX + interpolation * (0.2617994 - elytraRotationX);
		player.elytra.leftWing.rotation.z = elytraRotationZ + interpolation * (0.2617994 - elytraRotationZ);
		player.elytra.updateRightWing();
	}
}

export class WaveAnimation extends PlayerAnimation {
	static title = '挥手'
	static params = {
		...defaultParams,
		whichArm: {
			value: 'left' as 'left' | 'right' | 'both',
			desc: '挥动哪个胳膊',
			choices: ['left', 'right', 'both']
		},
		sameDirection: {
			value: true,
			desc: '挥动方向相同'
		}
	};

	params = getParamsValue(WaveAnimation.params);

	protected animate(player: PlayerObject, progress: number): void {
		const t = progress * 2 * Math.PI * this.params.multiple;

		const targetArm = this.params.whichArm === 'left' ? player.skin.leftArm : player.skin.rightArm;
		targetArm.rotation.x = 180;
		targetArm.rotation.z = Math.sin(t) * 0.5;
		if (this.params.whichArm === 'both') {
			player.skin.leftArm.rotation.x = targetArm.rotation.x;
			player.skin.leftArm.rotation.z = this.params.sameDirection ? targetArm.rotation.z : -Math.sin(t) * 0.5;
		}
	}
}

export class CrouchAnimation extends PlayerAnimation {
	static title = '蹲伏'
	static params = {
		...defaultParams,
		showProgress: {
			value: false,
			desc: '是否启用平滑过渡。 false (默认): 像 Minecraft 游戏内一样，瞬间在站立和蹲下间切换。true: 平滑地蹲下和起立（适合展示动画）。'
		},
		isStatic: {
			value: false,
			desc: '是否保持静止的蹲下状态。为 true 则忽略 progress，始终保持完全蹲下的姿态。'
		},
		isRunningHitAnimation: {
			value: false,
			desc: '是否同时播放攻击（挥手）动画'
		},
		hitCycles: {
			value: 8,
			desc: '攻击动画的次数'
		}
	};

	params = getParamsValue(CrouchAnimation.params);

	protected animate(player: PlayerObject, progress: number): void {
		// 1. 计算蹲下系数 (crouchFactor)
		// 范围 0.0 (站立) 到 1.0 (完全蹲下)
		let crouchFactor: number;

		if (this.params.isStatic) {
			crouchFactor = 1.0; // 始终蹲下
		} else {
			// 将 0-1 的进度映射为 0-1-0 的正弦波 (蹲下再站起)
			// progress: 0 -> 0.5 -> 1.0
			// angle:    0 -> PI  -> 2PI
			// sin:      0 -> 1   -> 0
			const t = progress * 2 * Math.PI * this.params.multiple;
			crouchFactor = Math.abs(Math.sin(t / 2));
		}

		// 2. 处理 "瞬间切换" 逻辑 (Minecraft 原版风格)
		if (!this.params.showProgress && !this.params.isStatic) {
			// 如果进度 > 0.5 则算蹲下，否则算站立
			crouchFactor = crouchFactor > (this.params.showProgress ? 0 : 0.4) ? 1.0 : 0.0;
		}

		// --- 应用身体位移和旋转 (使用 crouchFactor 插值) ---

		// 身体前倾
		player.skin.body.rotation.x = 0.4537860552 * crouchFactor;
		// 身体位置调整 (Y轴下降, Z轴后退)
		player.skin.body.position.y = -6 - 2.103677462 * crouchFactor;
		player.skin.body.position.z = 1.3256181 * crouchFactor - 3.4500310377 * crouchFactor;

		// 头部位置 (跟随身体下沉)
		player.skin.head.position.y = -3.618325234674 * crouchFactor;

		// 手臂位置和旋转
		// 基础位置偏移
		const armZ = 3.618325234674 * crouchFactor - 3.4500310377 * crouchFactor;
		const armY = -2 - 2.53943318 * crouchFactor;

		player.skin.leftArm.position.z = armZ;
		player.skin.rightArm.position.z = armZ;
		player.skin.leftArm.position.y = armY;
		player.skin.rightArm.position.y = armY;

		// 手臂旋转 (保持垂直或跟随身体)
		player.skin.leftArm.rotation.x = 0.410367746202 * crouchFactor;
		player.skin.rightArm.rotation.x = player.skin.leftArm.rotation.x;

		// 手臂微张
		player.skin.leftArm.rotation.z = 0.1;
		player.skin.rightArm.rotation.z = -0.1;

		// 腿部位置
		player.skin.leftLeg.position.z = -3.4500310377 * crouchFactor;
		player.skin.rightLeg.position.z = -3.4500310377 * crouchFactor;

		// 披风 (Cape) 调整
		player.cape.position.y = 8 - 1.851236166577372 * crouchFactor;
		player.cape.position.z = -2 + 3.786619432 * crouchFactor - 3.4500310377 * crouchFactor;
		player.cape.rotation.x = (10.8 * Math.PI) / 180 + 0.294220265771 * crouchFactor;

		// --- 鞘翅 (Elytra) 逻辑重写 ---
		// 移除 isCrouched 状态，直接基于 crouchFactor 计算位置
		player.elytra.position.x = player.cape.position.x;
		player.elytra.position.y = player.cape.position.y;
		player.elytra.position.z = player.cape.position.z;
		player.elytra.rotation.x = player.cape.rotation.x - (10.8 * Math.PI) / 180;

		// 鞘翅开合角度：
		// 站立时 (crouchFactor=0) -> 0.26 rad
		// 蹲下时 (crouchFactor=1) -> 0.72 rad (根据原代码逻辑推算)
		// 使用线性插值替代原有的复杂状态机
		const wingRotZ = 0.26179944 + 0.4582006 * crouchFactor;
		player.elytra.leftWing.rotation.z = wingRotZ;
		player.elytra.updateRightWing();

		// --- 攻击 (Hit) 动画逻辑 ---
		if (this.params.isRunningHitAnimation) {
			if (crouchFactor !== 1) {
				// 只在蹲下时播放
				if (crouchFactor === 0) {
					player.skin.body.rotation.y = 0;
				}
				return;
			}
			// 为了保证循环完美，攻击频率必须是主循环的整数倍。
			// 比如主循环是蹲下再起来 (1次)，期间挥动 2 次手。
			const t = progress * 2 * Math.PI * this.params.hitCycles;

			// 基础手臂旋转 Z
			const basicArmRotationZ = 0.01 * Math.PI + 0.06;

			// 右手攻击
			// 叠加在蹲下的旋转基础上
			const crouchOffsetX = 0.4537860552 * crouchFactor;

			// Right Arm Swing
			player.skin.rightArm.rotation.x = -crouchOffsetX + 2 * Math.sin(t + Math.PI) * 0.3 - crouchOffsetX;
			player.skin.rightArm.rotation.z = -Math.cos(t) * 0.403 + basicArmRotationZ;

			// Body Twist
			player.skin.body.rotation.y = -Math.cos(t) * 0.06;

			// Left Arm Compensation (摆动平衡)
			player.skin.leftArm.rotation.x = Math.sin(t + Math.PI) * 0.077 + 0.47 * crouchFactor;
			player.skin.leftArm.rotation.z = -Math.cos(t) * 0.015 + 0.13 - 0.05 * (1 - crouchFactor);

			// 左手位置微调 (仅在站立时明显，原代码逻辑)
			// 使用 (1 - crouchFactor) 来限制仅在站立附近生效
			const standFactor = 1 - crouchFactor;
			player.skin.leftArm.position.z += Math.cos(t) * 0.3 * standFactor;
			player.skin.leftArm.position.x = 5 - Math.cos(t) * 0.05 * standFactor;
		}
	}
}
export class HitAnimation extends PlayerAnimation {
	// multiple: number = 2;
	static title = '击打'
	static params = {
		...defaultParams,
		multiple: {
			value: 10,
			desc: defaultParams.multiple.desc
		}
	};

	params = getParamsValue(HitAnimation.params);
	protected animate(player: PlayerObject, progress: number): void {
		const t = progress * Math.PI * 2 * this.params.multiple;
		player.skin.rightArm.rotation.x = -0.4537860552 * 2 + 2 * Math.sin(t + Math.PI) * 0.3;
		const basicArmRotationZ = 0.01 * Math.PI + 0.06;
		player.skin.rightArm.rotation.z = -Math.cos(t) * 0.403 + basicArmRotationZ;
		player.skin.body.rotation.y = -Math.cos(t) * 0.06;
		player.skin.leftArm.rotation.x = Math.sin(t + Math.PI) * 0.077;
		player.skin.leftArm.rotation.z = -Math.cos(t) * 0.015 + 0.13 - 0.05;
		player.skin.leftArm.position.z = Math.cos(t) * 0.3;
		player.skin.leftArm.position.x = 5 - Math.cos(t) * 0.05;
	}
}

export class SpinUpAnimation extends PlayerAnimation {
	static title = '旋转起飞'
	static params = {
		...defaultParams,
		maxHeight: {
			value: 90,
			desc: '最高高度'
		},
		rotationTurns: {
			value: 6,
			desc: '旋转圈数'
		},
		/**分头行动 */
		headOff: {
			value: false,
			desc: '分头行动，为 true 时只有头飞走'
		}
	};

	params = getParamsValue(SpinUpAnimation.params);
	protected animate(player: PlayerObject, progress: number): void {
		// --- 1. 手臂平举动画 (前 30% 时间) ---
		const armProgress = clamp(progress / 0.3, 0, 1);

		// 使用 sin(x * PI/2) 可以在 x=1 时精确到达 1，实现平滑过渡
		const armSpreadFactor = Math.sin((armProgress * Math.PI) / 2);

		player.skin.leftArm.rotation.z = armSpreadFactor * (Math.PI / 2);
		player.skin.rightArm.rotation.z = -armSpreadFactor * (Math.PI / 2);

		// --- 2. 身体旋转 ---
		player.rotation.y = Math.pow(progress, 2) * (Math.PI * 2) * this.params.rotationTurns;

		const a = Math.pow(clamp(progress * 2, 0, 1), 2);
		player.cape.rotation.x = a * (Math.PI / 2);
		player.elytra.rotation.x = a * (Math.PI / 2 - 0.2); // -0.2 让鞘翅看起来不偏上

		// --- 3. 身体上升 (后 70% 时间) ---
		const flyStartThreshold = 0.3;
		let riseHeight = 0;

		if (progress > flyStartThreshold) {
			// 将 0.3 ~ 1.0 映射为 0 ~ 1
			const flyProgress = (progress - flyStartThreshold) / (1 - flyStartThreshold);

			riseHeight = Math.pow(flyProgress, 3) * this.params.maxHeight;
		}
		if (this.params.headOff) player.skin.head.position.y = riseHeight;
		else player.position.y = riseHeight;

		if (player.nameTag) player.nameTag.position.y = riseHeight + 20;
	}
}

export class RotateAnimation extends PlayerAnimation {
	static title = '旋转展示'
	static params = {
		...defaultParams
	};

	params = getParamsValue(RotateAnimation.params);
	protected animate(player: PlayerObject, progress: number): void {
		const t = progress * 2 * Math.PI * this.params.multiple;
		player.rotation.y = t;
		player.skin.leftArm.rotation.z = 0.1;
		player.skin.rightArm.rotation.z = -0.1;
	}
}

export class NodAnimation extends PlayerAnimation {
	// delay = 2;
	// amp = 0.5;
	static title = '点头'
	static params = {
		...defaultParams,
		delay: {
			value: 2,
			desc: defaultParams.delay.desc
		},
		amp: {
			value: 0.5,
			desc: '点头幅度'
		}
	};

	params = getParamsValue(NodAnimation.params);
	protected animate(player: PlayerObject, progress: number): void {
		const t = progress * 2 * Math.PI * this.params.multiple;
		player.skin.head.rotation.x = Math.sin(t) * this.params.amp;
	}
}
// 失败品
class FlailAnimation1 extends PlayerAnimation {
	multiple = 2;
	step = 0;
	protected animate(player: PlayerObject, progress: number): void {
		const t = progress * 2 * Math.PI * this.multiple + Math.PI / 2;

		const rad = Math.cos(t) * Math.PI * 0.5;
		player.skin.leftLeg.rotation.x = -rad;
		player.skin.rightLeg.rotation.x = rad;

		// x Math.PI/2 -> Math.PI -> 0 -> Math.PI -> y 0 -> Math.PI -> x 0 -> Math.PI/2
		//             1           2   2          2      2          2      1
		// const t1 = (progress - 1/3) * 2 * Math.PI
		if (this.step == 0 && progress > 7 / 12) {
			this.step++;
		} else if (this.step == 1 && progress > 11 / 12) {
			this.step++;
		}
		if (this.step == 1) {
			const rz = Math.PI / 2;
			player.skin.leftArm.rotation.z = rz;
			player.skin.rightArm.rotation.z = -rz;
			player.skin.leftArm.rotation.y = rad;
			player.skin.rightArm.rotation.y = rad;
			player.skin.leftArm.rotation.x = player.skin.rightArm.rotation.x = 0;
		} else {
			const rz = 0.3;
			player.skin.leftArm.rotation.z = rz;
			player.skin.rightArm.rotation.z = -rz;
			player.skin.leftArm.rotation.x = rad;
			player.skin.rightArm.rotation.x = -rad;
		}

		player.position.y = Math.cos(t * 2) * 1.2;
		player.position.x = Math.cos(t) * 0.15;
	}
}

// 辅助函数：线性插值
// 当 t=0 返回 start，t=1 返回 end，中间平滑过渡
function lerp(start: number, end: number, t: number): number {
	return start + (end - start) * t;
}

export class FlailAnimation extends PlayerAnimation {
	// multiple = 2;
	// delay = 4;
	static title = '手舞足蹈'
	static params = {
		...defaultParams,
		multiple: {
			value: 2,
			desc: defaultParams.multiple.desc
		},
		delay: {
			value: 4,
			desc: defaultParams.delay.desc
		}
	};

	params = getParamsValue(FlailAnimation.params);
	protected animate(player: PlayerObject, progress: number): void {
		// 1. 定义时间参数
		// highFreq: 高频震动（用于手脚快速摆动）
		const highFreq = progress * 2 * Math.PI * this.params.multiple;

		// lowFreq: 低频变化（用于控制状态过渡），0 -> 1 -> 0
		// 使用 Math.sin(progress * Math.PI) 可以保证首尾都是 0 (跑步态)，中间是 1 (发疯态)
		// 这样动画循环时是完美的：跑 -> 疯 -> 跑
		const blendFactor = Math.sin(progress * Math.PI);

		// 基础摆动幅度
		const swingRad = Math.sin(highFreq) * 1.9;

		// === 2. 腿部动作 (保持一直在跑) ===
		// 腿部不需要过渡，一直保持快速奔跑
		player.skin.leftLeg.rotation.x = -swingRad * 0.8;
		player.skin.rightLeg.rotation.x = swingRad * 0.8;

		// === 3. 手臂动作 (核心修改：平滑混合) ===

		// 状态 A: 跑步时手臂自然下垂 (Z轴接近0)
		const armZ_Run = 0.2;
		// 状态 B: 发疯时手臂平举 (Z轴 90度/PI/2)
		const armZ_Flail = Math.PI / 2 + 0.3;

		// 动态计算当前的 Z 轴角度：根据 blendFactor 在两者间平滑变化
		const currentArmZ = lerp(armZ_Run, armZ_Flail, blendFactor);

		player.skin.leftArm.rotation.z = currentArmZ;
		player.skin.rightArm.rotation.z = -currentArmZ;

		// 旋转轴混合：
		// 当 blendFactor 为 0 时，完全使用 X 轴旋转 (跑步摆臂)
		// 当 blendFactor 为 1 时，完全使用 Y 轴旋转 (直升机乱挥)
		// 中间状态会自动混合两个轴的旋转

		// X轴分量：跑步时满额，发疯时归零
		const rotX = swingRad * (1 - blendFactor);
		// Y轴分量：跑步时归零，发疯时满额
		const rotY = swingRad * blendFactor;

		player.skin.leftArm.rotation.x = rotX;
		player.skin.rightArm.rotation.x = -rotX;

		player.skin.leftArm.rotation.y = rotY;
		player.skin.rightArm.rotation.y = rotY;

		// === 4. 头部动作 (视线画圆) ===
		// 原理：X轴管上下，Y轴管左右。
		// 一个用 sin，一个用 cos，频率一致，就会形成圆周运动
		// 稍微降低一点频率(highFreq / 2)，不要晃得太晕
		const headSpeed = highFreq * 0.5;
		const headAmp = 0.8; // 晃动幅度

		player.skin.head.rotation.y = Math.sin(headSpeed) * headAmp; // 左右
		player.skin.head.rotation.x = Math.cos(headSpeed) * headAmp; // 上下
		// 稍微加一点 Z 轴歪头，看起来更疯癫
		player.skin.head.rotation.z = Math.sin(headSpeed * 0.5) * 0.1;

		// === 5. 身体位移 ===
		// 上下跳动
		player.position.y = Math.sin(highFreq * 2) * 2;
		// 左右胡乱位移
		player.position.x = Math.cos(highFreq * 0.5) * 0.5;
		// 身体稍微前倾一点
		player.rotation.x = 0.15;

		player.cape.rotation.x = Math.sin(highFreq * 2) * 0.2 + Math.PI * 0.3;

		if (player.nameTag) player.nameTag.position.y = player.position.y + 20;
	}
}
